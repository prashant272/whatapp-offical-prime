/**
 * Siren alarm system using Web Audio API to play a police-like sound.
 * Returns a stop function.
 */
export const startFollowUpAlarm = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let isPlaying = true;

    const playSirenCycle = () => {
      if (!isPlaying) return;
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine"; // Sine wave for a smoother siren
      const now = audioCtx.currentTime;
      
      // Initial frequency
      osc.frequency.setValueAtTime(600, now);
      
      // Slide up and down (Police Siren effect)
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.5);
      osc.frequency.exponentialRampToValueAtTime(600, now + 1.0);
      
      gain.gain.setValueAtTime(0.2, now);
      // Fade out slightly at the end of the 1s cycle
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.9);
      gain.gain.linearRampToValueAtTime(0, now + 1.0);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 1.0);
      
      // Loop every 1 second
      setTimeout(playSirenCycle, 1000);
    };

    playSirenCycle();

    return () => {
      isPlaying = false;
      audioCtx.close();
    };
  } catch (err) {
    console.error("Could not play siren sound:", err);
    return () => {};
  }
};
