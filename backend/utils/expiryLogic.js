const classifyExpiry = (expiryDate) => {
    if (!expiryDate) return 'Available';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight

    const expDate = new Date(expiryDate);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
        return 'Expired';
    } else if (diffDays <= 30) {
        return 'Near Expiry';
    } else {
        return 'Available';
    }
};

module.exports = {
    classifyExpiry
};
