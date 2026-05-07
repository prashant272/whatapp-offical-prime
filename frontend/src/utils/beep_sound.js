/**
 * Siren alarm system using Web Audio API to play a police-like sound.
 * Returns a stop function.
 */
export const startFollowUpAlarm = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTuk = (time) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, time);
      
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(time);
      osc.stop(time + 0.1);
    };

    const now = audioCtx.currentTime;
    playTuk(now);
    playTuk(now + 0.15); // Second 'tuk' for the 'tuk-tuk' effect

    return () => {
      audioCtx.close().catch(() => {});
    };
  } catch (err) {
    return () => {};
  }
};
