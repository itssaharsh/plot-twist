/**
 * PlotTwistAudio — one AudioComponent per cue (so cues can overlap), all LowLatency because
 * every cue answers a user action (pick-up, drop, Done, warning appearing).
 * Must not: decide when to play — Main and the controllers call these.
 */
export class PlotTwistAudio {
  private comps = new Map<string, AudioComponent>()

  constructor(
    host: SceneObject,
    tracks: {[key: string]: AudioTrackAsset | null},
    volume: number,
  ) {
    const audioRoot = global.scene.createSceneObject("Audio")
    audioRoot.setParent(host)
    for (const key of Object.keys(tracks)) {
      const track = tracks[key]
      if (!track) continue
      const ac = audioRoot.createComponent("Component.AudioComponent") as AudioComponent
      ac.audioTrack = track
      ac.volume = volume
      ac.playbackMode = Audio.PlaybackMode.LowLatency
      this.comps.set(key, ac)
    }
  }

  play(key: string): void {
    const ac = this.comps.get(key)
    if (!ac) return
    if (ac.isPlaying()) ac.stop(false)
    ac.play(1)
  }
}
