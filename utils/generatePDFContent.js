const formatAmount = require("./formatAmount");

const generatePDFContent = (
  doc,
  member,
  balance,
  transactions,
  totalDeposits,
  totalWithdrawals,
  startDate,
  endDate
) => {
  const pageWidth = doc.page.width - 100; // Account for margins
  const blue = "#3B82F6";
  const gray = "#6B7280";
  const darkGray = "#1F2937";

  // Header with CSEI branding
  doc.fontSize(28).fillColor(blue).text("CSEI", 50, 50);

  doc
    .fontSize(12)
    .fillColor(gray)
    .text("Caisse Solidaire des Entrepreneurs et Industriels", 50, 85);

  // Statement title
  doc.fontSize(22).fillColor(darkGray).text("ACCOUNT STATEMENT", 50, 130);

  // Statement info
  const statementDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc
    .fontSize(10)
    .fillColor(gray)
    .text(`Generated: ${statementDate}`, 400, 130);

  if (startDate && endDate) {
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    doc.text(`Period: ${start} - ${end}`, 400, 145);
  } else {
    doc.text("Period: All Transactions", 400, 145);
  }

  // Member Information Section
  let currentY = 190;

  doc.fontSize(16).fillColor(darkGray).text("ACCOUNT HOLDER", 50, currentY);

  currentY += 30;

  // Member details
  doc
    .fontSize(11)
    .fillColor(gray)
    .text("Name:", 50, currentY)
    .fillColor(darkGray)
    .text(member.member_name, 120, currentY);

  doc
    .fillColor(gray)
    .text("Member ID:", 350, currentY)
    .fillColor(darkGray)
    .text(member.member_id, 420, currentY);

  currentY += 18;

  doc
    .fillColor(gray)
    .text("Email:", 50, currentY)
    .fillColor(darkGray)
    .text(member.email, 120, currentY);

  doc
    .fillColor(gray)
    .text("Phone:", 350, currentY)
    .fillColor(darkGray)
    .text(member.first_telephone_line || "N/A", 420, currentY);

  currentY += 18;

  const address = [member.first_address_line, member.city, member.country]
    .filter(Boolean)
    .join(", ");

  if (address) {
    doc
      .fillColor(gray)
      .text("Address:", 50, currentY)
      .fillColor(darkGray)
      .text(address, 120, currentY);
  }

  // Account Summary Section
  currentY += 50;

  doc.fontSize(16).fillColor(darkGray).text("ACCOUNT SUMMARY", 50, currentY);

  currentY += 30;

  // Summary boxes
  const boxWidth = (pageWidth - 20) / 3;
  const boxHeight = 70;

  // Current Balance
  doc
    .rect(50, currentY, boxWidth, boxHeight)
    .fillColor("#F8FAFC")
    .fill()
    .rect(50, currentY, boxWidth, boxHeight)
    .strokeColor("#E2E8F0")
    .stroke();

  doc
    .fontSize(10)
    .fillColor(gray)
    .text("CURRENT BALANCE", 60, currentY + 15);

  doc
    .fontSize(18)
    .fillColor(balance >= 0 ? "#059669" : "#DC2626")
    .text(`${formatAmount(balance)} FCFA`, 60, currentY + 35);

  // Total Deposits
  const depositX = 50 + boxWidth + 10;
  doc
    .rect(depositX, currentY, boxWidth, boxHeight)
    .fillColor("#F0FDF4")
    .fill()
    .rect(depositX, currentY, boxWidth, boxHeight)
    .strokeColor("#BBF7D0")
    .stroke();

  doc
    .fontSize(10)
    .fillColor(gray)
    .text("TOTAL DEPOSITS", depositX + 10, currentY + 15);

  doc
    .fontSize(18)
    .fillColor("#059669")
    .text(`${formatAmount(totalDeposits)} FCFA`, depositX + 10, currentY + 35);

  // Total Withdrawals
  const withdrawalX = 50 + (boxWidth + 10) * 2;
  doc
    .rect(withdrawalX, currentY, boxWidth, boxHeight)
    .fillColor("#FEF2F2")
    .fill()
    .rect(withdrawalX, currentY, boxWidth, boxHeight)
    .strokeColor("#FECACA")
    .stroke();

  doc
    .fontSize(10)
    .fillColor(gray)
    .text("TOTAL WITHDRAWALS", withdrawalX + 10, currentY + 15);

  doc
    .fontSize(18)
    .fillColor("#DC2626")
    .text(
      `${formatAmount(totalWithdrawals)} FCFA`,
      withdrawalX + 10,
      currentY + 35
    );

  // Transaction History
  currentY += 120;

  doc
    .fontSize(16)
    .fillColor(darkGray)
    .text("TRANSACTION HISTORY", 50, currentY);

  currentY += 30;

  if (transactions.length === 0) {
    doc
      .fontSize(11)
      .fillColor(gray)
      .text("No transactions found for the selected period.", 50, currentY);
  } else {
    // Table headers
    const headers = ["Date", "Description", "Document No.", "Amount (FCFA)"];
    const columnWidths = [90, 250, 100, 100];
    let headerX = 50;

    // Header background
    doc
      .rect(50, currentY - 5, pageWidth, 25)
      .fillColor("#F1F5F9")
      .fill();

    doc.fontSize(10).fillColor(darkGray);

    headers.forEach((header, index) => {
      doc.text(header, headerX + 5, currentY + 5, {
        width: columnWidths[index] - 5,
      });
      headerX += columnWidths[index];
    });

    currentY += 25;

    // Transaction rows
    transactions.slice(0, 25).forEach((transaction, index) => {
      // Check for new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      // Alternating row colors
      if (index % 2 === 0) {
        doc
          .rect(50, currentY - 2, pageWidth, 20)
          .fillColor("#FAFAFA")
          .fill();
      }

      let cellX = 50;
      const amount = parseFloat(transaction.originalAmount || 0);

      doc.fontSize(9).fillColor(darkGray);

      // Date
      const date = new Date(transaction.postingDate).toLocaleDateString();
      doc.text(date, cellX + 5, currentY + 3, { width: columnWidths[0] - 5 });
      cellX += columnWidths[0];

      // Description
      doc.text(transaction.description || "N/A", cellX + 5, currentY + 3, {
        width: columnWidths[1] - 5,
        ellipsis: true,
      });
      cellX += columnWidths[1];

      // Document Number
      doc.text(transaction.documentNo || "-", cellX + 5, currentY + 3, {
        width: columnWidths[2] - 5,
      });
      cellX += columnWidths[2];

      // Amount
      doc
        .fillColor(amount >= 0 ? "#059669" : "#DC2626")
        .text(formatAmount(amount), cellX + 5, currentY + 3, {
          width: columnWidths[3] - 5,
        });

      currentY += 18;
    });

    if (transactions.length > 25) {
      currentY += 15;
      doc
        .fontSize(10)
        .fillColor(gray)
        .text(
          `Showing latest 25 transactions. Total: ${transactions.length}`,
          50,
          currentY
        );
    }
  }

  // Footer
  const footerY = doc.page.height - 80;

  doc
    .fontSize(8)
    .fillColor(gray)
    .text(
      "This is a computer-generated statement and does not require a signature.",
      50,
      footerY
    )
    .text(`Generated on ${new Date().toLocaleString()}`, 50, footerY + 12)
    .text(
      "© CSEI - Caisse Solidaire des Entrepreneurs et Industriels",
      50,
      footerY + 24
    );
};

module.exports = generatePDFContent;