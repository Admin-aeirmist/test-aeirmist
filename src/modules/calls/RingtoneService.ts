class RingtoneService {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private activeNodes: AudioNode[] = [];
  private activeTimeouts: any[] = [];

  private init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private createSynthVoice(freq: number, type: 'audio' | 'video') {
    if (!this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const subOsc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.type = type === 'video' ? 'sine' : 'triangle';
    subOsc.type = 'sine';
    
    osc.frequency.setValueAtTime(freq, now);
    subOsc.frequency.setValueAtTime(freq * 0.5, now);
    
    // Slight modulation for futuristic feel
    osc.frequency.exponentialRampToValueAtTime(freq * 1.01, now + 1);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + 1.5);
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 1.5);
    subOsc.stop(now + 1.5);

    this.activeNodes.push(osc, subOsc, gain, filter);
  }

  playRingtone(type: 'audio' | 'video' = 'audio') {
    if (this.isPlaying) return;
    this.init();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
    this.isPlaying = true;

    const sequence = type === 'video' ? [523.25, 659.25, 783.99] : [440, 554.37, 659.25]; // C5, E5, G5 vs A4, C#5, E5

    const playLoop = () => {
      if (!this.isPlaying || !this.audioContext) return;
      
      sequence.forEach((freq, i) => {
        const t = setTimeout(() => {
          if (this.isPlaying) this.createSynthVoice(freq, type);
        }, i * 150);
        this.activeTimeouts.push(t);
      });

      const nextLoop = setTimeout(playLoop, 2500);
      this.activeTimeouts.push(nextLoop);
    };

    playLoop();
  }

  playDialTone() {
    if (this.isPlaying) return;
    this.init();
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
    this.isPlaying = true;

    const playMessage = () => {
      if (!this.isPlaying || !this.audioContext) return;

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.6);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.1);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      osc.stop(now + 0.8);

      this.activeNodes.push(osc, gain);
      const nextTone = setTimeout(playMessage, 1500);
      this.activeTimeouts.push(nextTone);
    };

    playMessage();
  }

  stop() {
    this.isPlaying = false;
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts = [];
    this.activeNodes.forEach(node => {
      try {
        node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }
}

export const aeirmistRingtone = new RingtoneService();
