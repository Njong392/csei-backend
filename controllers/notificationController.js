// controllers/notificationController.js
const sql = require("mssql");
const transporter = require("../utils/nodemailerTransporter");
const formatAmount = require("../utils/formatAmount");

// Function to check balance changes and send notifications
exports.checkAndNotifyBalanceChanges = async (req, res) => {
  try {
    console.log("Checking for balance changes...");

    // Get all members with their current balances
    const request = new sql.Request();
    const result = await request.query(`
            SELECT 
                m.member_id,
                m.member_name,
                m.email,
                csei_database.dbo.CustomerBalance(m.member_id) AS current_balance,
                m.last_notified_balance
            FROM Members m
            WHERE m.email IS NOT NULL AND m.email != ''
        `);

    const members = result.recordset;
    let notificationsSent = 0;

    for (const member of members) {
      const currentBalance = parseFloat(member.current_balance || 0);
      const lastNotifiedBalance = parseFloat(member.last_notified_balance || 0);

      // Check if balance has changed
      if (currentBalance !== lastNotifiedBalance) {
        console.log(
          `Balance change detected for ${member.member_name}: ${lastNotifiedBalance} → ${currentBalance}`
        );

        // Send notification
        await sendBalanceChangeNotification(
          member,
          lastNotifiedBalance,
          currentBalance
        );

        // Update the last notified balance
        await updateLastNotifiedBalance(member.member_id, currentBalance);

        notificationsSent++;
      }
    }

    console.log(
      `Checked ${members.length} members, sent ${notificationsSent} notifications`
    );

    res.status(200).json({
      message: `Balance check completed`,
      membersChecked: members.length,
      notificationsSent: notificationsSent,
    });
  } catch (error) {
    console.error("Error checking balance changes:", error);
    res.status(500).json({ error: error.message });
  }
};

// Send balance change notification email
const sendBalanceChangeNotification = async (
  member,
  previousBalance,
  newBalance
) => {
  try {
    const balanceChange = newBalance - previousBalance;
    const isCredit = balanceChange > 0;

    // Get recent transactions to provide context
    const request = new sql.Request();
    request.input("member_id", sql.VarChar(10), member.member_id);

    const transactionResult = await request.query(`
            SELECT TOP 3
                [Description],
                [Original Amount],
                [Posting Date],
                [Document No_]
            FROM MemberTransactionSummary 
            WHERE member_id = @member_id 
            ORDER BY [Posting Date] DESC
        `);

    const recentTransactions = transactionResult.recordset;

    // Email content
    const emailSubject = isCredit
      ? "Account Credited - CSEI"
      : "Account Debited - CSEI";

    const emailHtml = `
            <h2>Account Balance Update</h2>
            <p>Dear ${member.member_name},</p>
            <p>Your account balance has been updated.</p>
            
            <h3>Transaction Details:</h3>
            <ul>
                <li><strong>Amount:</strong> ${
                  isCredit ? "+" : ""
                }${formatAmount(balanceChange)} FCFA</li>
                <li><strong>Previous Balance:</strong> ${formatAmount(
                  previousBalance
                )} FCFA</li>
                <li><strong>New Balance:</strong> ${formatAmount(
                  newBalance
                )} FCFA</li>
                <li><strong>Date:</strong> ${new Date().toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}</li>
            </ul>
            
            ${
              newBalance < 0
                ? `
            <p style="color: #DC2626;"><strong>Note:</strong> Your account balance is now negative (${formatAmount(
              newBalance
            )} FCFA). Please contact us to resolve this.</p>
            `
                : ""
            }
            
            ${
              recentTransactions.length > 0
                ? `
            <h3>Recent Transactions:</h3>
            <ul>
                ${recentTransactions
                  .map(
                    (tx) => `
                    <li>${tx.Description || "Transaction"} - ${formatAmount(
                      tx["Original Amount"]
                    )} FCFA (${new Date(
                      tx["Posting Date"]
                    ).toLocaleDateString()})</li>
                `
                  )
                  .join("")}
            </ul>
            `
                : ""
            }
            
            <p>If you have any questions about this transaction, please contact us.</p>
            <p>Thank you for choosing CSEI.</p>
        `;

    const mailOptions = {
      from: '"CSEI Notifications" <notifications@csei.com>',
      to: member.email,
      subject: emailSubject,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `Balance notification sent to ${member.member_name} (${member.email})`
    );
  } catch (error) {
    console.error(
      `Error sending notification to ${member.member_name}:`,
      error
    );
  }
};

// Update the last notified balance for a member
const updateLastNotifiedBalance = async (memberId, newBalance) => {
  try {
    const request = new sql.Request();
    request.input("member_id", sql.VarChar(10), memberId);
    request.input("balance", sql.Decimal(18, 2), newBalance);

    await request.query(`
            UPDATE Members 
            SET last_notified_balance = @balance 
            WHERE member_id = @member_id
        `);
  } catch (error) {
    console.error("Error updating last notified balance:", error);
  }
};


