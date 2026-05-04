const classifyExpiry = (expiryDate) => {
    if (!expiryDate) return 'unknown';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight

    const expDate = new Date(expiryDate);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 'expired';
    } else if (diffDays <= 7) {
        return 'near_expiry';
    } else {
        return 'available';
    }
};

module.exports = {
    classifyExpiry
};
