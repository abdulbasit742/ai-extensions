// [ARIA] V48 PULSE-POST - Robust YouTube Adapter
export const YouTubeAdapter = {
  init: () => {
    console.log("YouTube Adapter V48 Active.");
    setInterval(() => {
      const video = document.querySelector('video');
      if (video && video.paused) video.play().catch(() => {});
      const skipBtn = document.querySelector('.ytp-ad-skip-button');
      if (skipBtn) skipBtn.click();
    }, 5000);
  },
  
  postComment: async (text) => {
    console.log(`Pulse-Post: Attempting injection of "${text}"`);
    
    // 1. Ensure comments are in view
    window.scrollTo(0, 600);
    
    // 2. Multi-selector strategy for the comment box
    const selectors = [
      '#placeholder-area',
      '#simplebox-placeholder',
      'ytd-comment-simplebox-renderer',
      '#comment-simplebox'
    ];
    
    let commentBox = null;
    for (const selector of selectors) {
      commentBox = document.querySelector(selector);
      if (commentBox) break;
    }
    
    if (!commentBox) {
      console.error("Could not find YouTube comment box.");
      return false;
    }
    
    commentBox.click();
    
    // 3. Wait for the actual input field to appear
    setTimeout(() => {
      const input = document.querySelector('#contenteditable-root') || 
                    document.querySelector('#contenteditable-textarea') ||
                    document.querySelector('div[contenteditable="true"]');
                    
      if (input) {
        input.focus();
        input.innerText = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 4. Click the submit button
        setTimeout(() => {
          const submitBtn = document.querySelector('#submit-button') || 
                            document.querySelector('ytd-button-renderer#submit-button') ||
                            document.querySelector('button[aria-label="Comment"]');
                            
          if (submitBtn) {
            submitBtn.click();
            console.log("Pulse-Post: Comment submitted successfully.");
          }
        }, 500);
      }
    }, 1500);
    
    return true;
  }
};
