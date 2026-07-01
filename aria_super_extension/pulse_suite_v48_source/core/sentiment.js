// [ARIA] V47 ECHO-COMMENT - Sentiment Analysis
export const Sentiment = {
  analyze: (text) => {
    const positiveWords = ["great", "awesome", "love", "good", "nice", "best"];
    const negativeWords = ["bad", "hate", "worst", "terrible", "awful"];
    
    let score = 0;
    const words = text.toLowerCase().split(/\W+/);
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score++;
      if (negativeWords.includes(word)) score--;
    });
    
    if (score > 0) return "POSITIVE";
    if (score < 0) return "NEGATIVE";
    return "NEUTRAL";
  }
};
