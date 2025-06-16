const verifyRole = (req, res, next) => {
    try{
        const user = req.user // we have access to the user object from the requireAuth middleware
        const { role } = user // extract role from user object

        if(role.trim() !== 'admin'){
            return res.status(401).json({error: 'Access denied. Admins only.'})
        }
        next() // if role is admin, proceed to the next middleware or route handler
    } catch{
        return res.status(500).json({error: 'Internal server error'})
    }
}

module.exports = verifyRole