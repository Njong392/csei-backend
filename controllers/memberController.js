const sql = require('mssql')
const checkRequiredFields = require('../utils/missingFields')
const config = require('../config/tableConfig')
const bcrypt = require("bcrypt")

// member log in
exports.memberLogin = async(req, res) => {
    const { memberId, password } = req.body;
  const requiredFields = config.loginRequiredFields;

  // Validate required fields
  const missingFields = checkRequiredFields(req.body, requiredFields);
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  try{
    const request = new sql.Request()
    request.input('memberId', sql.VarChar(50), memberId);
    const result = await request.query('SELECT * FROM Members WHERE member_id = @memberId')

    if(result.recordset.length === 0){
        return res.status(404).json({error: 'No such member found'})
    }

    const member = result.recordset[0]

    // Compare password with hashed password
    const passwordMatch = await bcrypt.compare(password, member.password)

    if(!passwordMatch){
        return res.status(401).json({error: 'Invalid password'})
    }

    res.status(200).json({message: 'Login succesful'})

  } catch (err){
    res.status(500).json({error: err.message})
  }
}
