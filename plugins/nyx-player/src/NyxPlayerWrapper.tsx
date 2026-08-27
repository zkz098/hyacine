import { createModernMetingProvider, NyxPlayer } from "nyx-player-solid";
import "nyx-player-solid/style";

export interface NyxPlayerPlaylist {
  name: string;
  url: string;
}

export interface NyxPlayerWrapperProps {
  urls: NyxPlayerPlaylist[];
  preset?: "nyx" | "shokax";
  darkModeTarget?: string;
  metingBaseURL?: string;
  metingUrlSource?: "outer" | "proxy";
  showBtn?: string;
  playBtn?: string;
}

export default function NyxPlayerWrapper(props: NyxPlayerWrapperProps) {
  const metingProvider = props.metingBaseURL
    ? createModernMetingProvider({
        baseURL: props.metingBaseURL,
        urlSource: props.metingUrlSource ?? "outer",
      })
    : undefined;

  return (
    <NyxPlayer
      urls={props.urls ?? []}
      showBtn={props.showBtn ?? "#nyx-show-btn"}
      playBtn={props.playBtn ?? "#nyx-play-btn"}
      darkModeTarget={props.darkModeTarget ?? ':root[data-theme="dark"]'}
      preset={props.preset ?? "shokax"}
      provider={metingProvider}
    />
  );
}
