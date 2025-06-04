const checkRequiredFields = (body, requiredFields) => {
    const missing = requiredFields.filter(field => body[field] === undefined || body[field] === null || body[field] === '')
    return missing
}

module.exports = checkRequiredFields;