const config = {
  prospectRequiredFields: [
    "referrerId",
    "prospectName",
    "prospectSurname",
    "dateOfBirth",
    "firstAddressLine",
    "city",
    "country",
    "firstTelephoneLine",
    "email",
    "emergencyContact",
    "emergencyEmail",
    "emergencyPhonenumber",
    "monthlyCommitment",
    "swornStatement",
    "prospectStatus",
    "telegramContact",
  ],

  memberRequiredFields:[
    
    "memberName",
    "memberSurname",
    "dateOfBirth",
    "firstAddressLine",
    "city",
    "country",
    "firstTelephoneLine",
    "email",
    "telegramContact",
    "emergencyContact",
    "emergencyPhonenumber",
    "emergencyEmail",

  ],

  loginRequiredFields: [
    "memberId",
    "password"
  ]
};

module.exports = config;