const calculateBestPrice = (regularPrice, productOffer = 0, categoryOffer = 0) => {
  // Ensure offers are valid numbers
  productOffer = Number(productOffer) || 0;
  categoryOffer = Number(categoryOffer) || 0;
  
  // Get the better offer between product and category
  const bestOffer = Math.max(productOffer, categoryOffer);
  
  // Calculate discount amount
  const discountAmount = (regularPrice * bestOffer) / 100;
  
  // Calculate final price
  const finalPrice = regularPrice - discountAmount;
  
  return {
    regularPrice,
    finalPrice: Math.round(finalPrice * 100) / 100, // Round to 2 decimal places
    appliedOffer: bestOffer,
    offerType: bestOffer === productOffer && bestOffer === categoryOffer ? 
      'both' : 
      bestOffer === productOffer ? 
        'product' : 
        'category',
    savedAmount: Math.round(discountAmount * 100) / 100
  };
};

module.exports = {
  calculateBestPrice
};