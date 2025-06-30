const jwt = require('jsonwebtoken')

const requireAuth = (req, res, next) => {
    try{
        // get cookie from header
        const cookie = req.cookies.sessionToken

        // if header does not exist, throw authorization error
        if(!cookie){
            return res.status(401).json({error: 'Session token missing'})
        }

        // verify if the token has been tampered with of if expired
        jwt.verify(cookie, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
            if(err){
                return res.status(401).json({error: 'Invalid or expired token'})
            }

            // if token is valid, attach the decoded user id info to the request object. 
            // `decoded` contains the payload of the jwt which was added during signing
            req.user = decoded
            next()
        })

    } catch{
        return res.status(500).json({error: 'Internal server error'})
    }
}

module.exports = requireAuth