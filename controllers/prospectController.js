const sql = require('mssql')
const checkRequiredFields = require('../utils/missingFields')
const config = require('../config/tableConfig')


// Read/GET prospects from db
exports.getProspects = async (req, res) => {
    try{
        const request = new sql.Request()

        const result = await request.query('SELECT * FROM Prospects')
        res.status(200).json(result.recordset)
    } catch(err) {
        res.status(500).json({error: err.message})
    }
}

// Create/POST prospect to db
exports.addProspect = async(req, res) => {
    const requiredFields = config.prospectRequiredFields

     // Validate required fields
     const missingFields = checkRequiredFields(req.body, requiredFields)
     if(missingFields.length > 0){
        return res.status(400).json({
            error: `Missing required fields: ${missingFields.join(', ')}`
        })
     }

     // add prospect to db with stored procedure
     try{
        const request = new sql.Request()
        request.input('referrer_id', sql.VarChar(50), req.body.referrerId);
        request.input('prospect_name', sql.VarChar(50), req.body.prospectName);
        request.input('prospect_surname', sql.VarChar(50), req.body.prospectSurname);
        request.input('date_of_birth', sql.Date, req.body.dateOfBirth);
        request.input('first_address_line', sql.VarChar(50), req.body.firstAddressLine);
        request.input('second_address_line', sql.VarChar(50), req.body.secondAddressLine);
        request.input('city', sql.VarChar(50), req.body.city);
        request.input('country', sql.VarChar(50), req.body.country);
        request.input('first_telephone_line', sql.VarChar(50), req.body.firstTelephoneLine);
        request.input('second_telephone_line', sql.VarChar(20), req.body.secondTelephoneLine);
        request.input('email', sql.VarChar(50), req.body.email);
        request.input('emergency_contact', sql.VarChar(50), req.body.emergencyContact);
        request.input('emergency_phonenumber', sql.VarChar(20), req.body.emergencyPhonenumber);
        request.input('emergency_email', sql.VarChar(50), req.body.emergencyEmail);
        request.input('monthly_commitment', sql.Decimal(18, 0), req.body.monthlyCommitment);
        request.input('sworn_statement', sql.Bit, req.body.swornStatement);
        request.input('prospect_status', sql.VarChar(50), req.body.prospectStatus);
        request.input('telegram_contact', sql.VarChar(50), req.body.telegramContact);

        await request.execute('AddProspect')
        res.status(201).json({message: 'Prospect added succesfully'})

     } catch(err){
        res.status(500).json({error: err.message})
     }
    
}

// Get a single prospect
exports.getProspect = async(req, res) => {
    const { id } = req.params

    try{
        const request = new sql.Request()
        request.input('prospect_id', sql.UniqueIdentifier, id)

        const result = await request.execute('getProspect')
        if(result.recordset.length === 0){
            return res.status(404).json({error: 'Prospect not found'})
        }

        res.status(200).json(result.recordset[0])
    } catch(err){
        return res.status(500).json({error: err.message})
    }
}

// Update prospect 

// Delete a Prospect 

