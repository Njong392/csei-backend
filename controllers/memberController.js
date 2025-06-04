const sql = require('mssql')
const checkRequiredFields = require('../utils/missingFields')
const config = require('../config/tableConfig')

// Create/POST member to db
exports.addProspect = async(req, res) => {
    const requiredFields = config.memberRequiredFields

    // Validate required fields
    const missingFields = checkRequiredFields(req.body, requiredFields)
    if(missingFields.length > 0){
        return res.status(400).json({
            error: `Missing required fields: ${missingFields.join(', ')}`
        })
    }


    // add member to db with stored procedure
    try{
        const request = new sql.Request()
        request.input('member_id', sql.VarChar(50), req.body.memberId);
        request.input('member_name', sql.VarChar(50), req.body.memberName);
        request.input('member_surname', sql.VarChar(50), req.body.memberSurname);
        request.input('date_of_birth', sql.Date, req.body.dateOfBirth);
        request.input('first_address_line', sql.VarChar(50), req.body.firstAddressLine);
        request.input('second_address_line', sql.VarChar(50), req.body.secondAddressLine);
        request.input('city', sql.VarChar(50), req.body.city);
        request.input('country', sql.VarChar(50), req.body.country);
        request.input('first_telephone_line', sql.VarChar(50), req.body.firstTelephoneLine);
        request.input('second_telephone_line', sql.VarChar(20), req.body.secondTelephoneLine);
        request.input('email', sql.VarChar(50), req.body.email);
        request.input('telegram_contact', sql.VarChar(50), req.body.telegramContact);
        request.input('emergency_contact', sql.VarChar(50), req.body.emergencyContact);
        request.input('emergency_phonenumber', sql.VarChar(20), req.body.emergencyPhonenumber);
        request.input('emergency_email', sql.VarChar(50), req.body.emergencyEmail);

        await request.execute('AddMember')
        res.status(201).json({message: 'Member added successfully'})
    } catch(err){
        res.status(500).json({error: err.message})
    }
}