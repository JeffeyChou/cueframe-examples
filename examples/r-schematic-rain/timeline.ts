import { timeline } from '@cueframe/core'
import montage from './scenes/montage.js'

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 30,
  deliver: 'music-master',
  audio: '/build/music.wav',
  scenes: [montage],
  fonts: [{ family: 'JetBrains Mono', src: '/data/fonts/JetBrainsMono.ttf', weight: '400' }],
})
