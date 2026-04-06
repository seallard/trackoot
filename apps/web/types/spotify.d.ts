interface Window {
  onSpotifyWebPlaybackSDKReady: () => void;
  Spotify: {
    Player: new (options: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }) => {
      addListener(event: "ready", cb: (state: { device_id: string }) => void): void;
      connect(): Promise<boolean>;
    };
  };
}
