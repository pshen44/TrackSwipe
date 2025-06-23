import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { StyleSheetManager } from 'styled-components';
import axios from 'axios';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { useSwipeable, SwipeEventData } from 'react-swipeable';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

const CLIENT_ID = '06b9dadfd2144324a7ed4d37dbe1245f'; // Replace with your Spotify Client ID
const REDIRECT_URI = 'https://trackswipe.vercel.app'; // Make sure this matches your Spotify app settings
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SCOPE = 'playlist-read-private playlist-modify-private playlist-modify-public playlist-read-collaborative';

const SCOPE_PLAYBACK = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';

const FULL_SCOPE = `${SCOPE} ${SCOPE_PLAYBACK}`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: #191414; // Spotify dark black
  padding: 32px 24px 0 24px;
  box-sizing: border-box;
  max-width: 100vw;
  max-height: 100vh;
  overflow-x: hidden;
  font-size: 1.25rem;
  @media (max-width: 600px) {
    padding: 24px 12px 0 12px;
    font-size: 1rem;
    height: 100vh;
    overflow-y: hidden;
    width: 100vw;
    max-width: 100vw;
    position: fixed;
    left: 0;
    top: 0;
  }
`;

const CardContainer = styled.div`
  width: 320px;
  height: 480px;
  position: relative;
  margin: 32px auto 0 auto;
  transform: translateZ(0);
  max-width: 92vw;
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  margin-top: 16px; // Reduced from 40px
  position: relative;
  @media (max-width: 600px) {
    flex-direction: column;
    align-items: center;
    margin-top: 8px;
  }
`;

const SongCard = styled.div<{ transform?: string }>`
  position: absolute;
  width: 320px;
  height: 480px;
  background: #232323; // Lighter than #191414 for contrast
  border-radius: 32px;
  padding: 32px;
  box-shadow: 0px 14px 32px rgba(43, 255, 89, 0.22);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.3s ease-out;
  transform: ${props => props.transform || 'none'};
  user-select: none;
  border: 2.5px solid transparent;
  color: #fff; // Make all text inside the card white
  margin: 0 auto;
  max-width: 92vw;
  &:hover {
    border-color: #1db954;
  }
  @media (max-width: 600px) {
    border-radius: 32px;
    padding: 16px 8px 20px 8px;
    box-shadow: 0 4px 18px rgba(29,185,84,0.18);
    border: 2.5px solid transparent;
    margin: 0 auto 12px auto;
    height: 380px;
  }
`;

const SongInfo = styled.div`
  text-align: center;
`;

const Title = styled.h2`
  margin: 0;
  color: #fff; // White title
  @media (max-width: 600px) {
    font-size: 1.1rem;
    text-align: center;
    padding: 8px 0 0 0;
    word-break: break-word;
    line-height: 1.2;
    margin-bottom: 8px;
  }
`;

const Artist = styled.p`
  color: #ccc; // Light gray for artist
  margin: 10px 0;
`;

const AlbumArt = styled.img`
  width: 100%;
  aspect-ratio: 1/1;
  height: auto;
  object-fit: cover;
  border-radius: 14px;
  margin: 18px 0;
  user-select: none;
  pointer-events: none;
  @media (max-width: 600px) {
    width: 100%;
    aspect-ratio: 1/1;
    height: auto;
    border-radius: 18px;
    margin: 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.10);
  }
`;

const Button = styled.button`
  background: #1db954;
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 20px;
  margin: 16px;
  &:hover {
    background: #1ed760;
  }
  @media (max-width: 600px) {
    width: 90vw;
    font-size: 1.1rem;
    padding: 14px 0;
    margin: 10px 0;
  }
`;

const SwipeIndicator = styled.div<{ direction: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${props => props.direction === 'left' ? 'left: 20px;' : 'right: 20px;'}
  transform: translateY(-50%);
  background: ${props => props.direction === 'left' ? '#ff4b4b' : '#1DB954'};
  color: white;
  padding: 10px 15px;
  border-radius: 20px;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.3s ease;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 1;
`;

const PlaylistInput = styled.input`
  padding: 22px;
  margin: 24px;
  width: 440px;
  border-radius: 28px;
  border: 2.5px solid #1DB954;
  font-size: 1.5rem;
  &:focus {
    outline: none;
    border-color: #1ed760;
  }
  @media (max-width: 600px) {
    width: 90vw;
    font-size: 1.1rem;
    padding: 12px;
    margin: 12px 0;
  }
`;

const LoadPlaylistButton = styled(Button)`
  font-size: 2rem;
  padding: 24px 48px;
  margin: 32px 0 0 0;
`;

const TransparentLogoutButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(25, 25, 25, 0.0);
  border: 2px solid #1DB954;
  color: #1DB954;
  padding: 14px 32px;
  border-radius: 18px;
  cursor: pointer;
  font-size: 1.3rem;
  transition: all 0.3s ease;
  z-index: 2000;
  pointer-events: auto;
  &:hover {
    background: #1DB954;
    color: white;
  }
  @media (max-width: 600px) {
    padding: 8px 16px;
    font-size: 1rem;
    top: 8px;
    right: 8px;
  }
`;

const RemovedSongsList = styled.div<{isScrollable?: boolean}>`
  margin-top: 80px; // Increased from 20px to move it down
  color: white;
  position: absolute;
  left: 20px;
  top: 0;
  width: 300px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 15px;
  border: 1px solid #1DB954;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
  max-height: ${props => props.isScrollable ? '450px' : 'auto'};
  overflow-y: ${props => props.isScrollable ? 'auto' : 'visible'};
  padding-right: 10px;
  @media (max-width: 600px) {
    display: none;
  }

  h3 {
    margin-bottom: 10px;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    background: #191414;
    padding: 8px 12px;
    margin-bottom: 5px;
    border-radius: 5px;
    font-size: 14px;
    display: flex;
    align-items: center;
  }
  img {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 3px;
    margin-right: 10px;
  }
`;

const ApplyButton = styled(Button)`
  margin-top: 20px;
  background: #ff4b4b; /* Reddish color for remove action */
  &:hover {
    background: #e04343;
  }
  @media (max-width: 600px) {
    font-size: 1rem;
    padding: 10px 0;
    width: 60vw;
    margin-top: 12px;
  }
`;

const KeptSongsList = styled.div<{isScrollable?: boolean}>`
  margin-top: 80px; // Increased from 20px to move it down
  color: white;
  position: absolute;
  right: 20px;
  top: 0;
  width: 300px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  padding: 15px;
  border: 1px solid #1DB954;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
  max-height: ${props => props.isScrollable ? '450px' : 'auto'};
  overflow-y: ${props => props.isScrollable ? 'auto' : 'visible'};
  padding-right: 10px;
  @media (max-width: 600px) {
    display: none;
  }

  h3 {
    margin-bottom: 10px;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    background: #191414;
    padding: 8px 12px;
    margin-bottom: 5px;
    border-radius: 5px;
    font-size: 14px;
    display: flex;
    align-items: center;
  }
  img {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 3px;
    margin-right: 10px;
  }
`;

const CardAndButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 18px;
  @media (max-width: 600px) {
    margin-top: 6px;
  }
`;

const TopBar = styled.div`
  width: 100vw;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  padding: 24px 36px 0 36px;
  z-index: 2000;
  pointer-events: none;
  @media (max-width: 600px) {
    padding: 12px 12px 0 12px;
    justify-content: flex-end;
  }
`;

const TopBarButton = styled(Button)`
  margin: 0 0 0 0;
  font-size: 1.1rem;
  padding: 12px 28px;
  pointer-events: auto;
  opacity: 1;
  @media (max-width: 600px) {
    font-size: 1rem;
    padding: 8px 18px;
    width: auto;
    min-width: 0;
    margin: 0 0 0 8px;
    display: block;
    opacity: 1;
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

const Logo = styled.h1`
  color: #1DB954; // Spotify green
  font-size: 3.5rem;
  margin-bottom: 36px;
  font-weight: 900;
  letter-spacing: 2px;
  text-shadow: 0 2px 12px rgba(0,0,0,0.08);
  background: none;
  text-align: center;
  width: 100%;
  position: absolute;
  top: -25px; 
  left: 0;
  z-index: 1500;
  pointer-events: none;
  @media (max-width: 600px) {
    font-size: 2rem;
    top: 0;
    margin-bottom: 12px;
    position: static;
  }
`;

const PlaylistHeaderButton = styled.button`
  display: flex;
  flex-direction: row;
  align-items: center;
  position: absolute;
  top: 18px;
  left: 1150px;
  z-index: 1600;
  gap: 20px;
  background: rgba(25,25,25,0.92);
  border-radius: 18px;
  padding: 12px 28px 12px 18px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  outline: none;
`;

const PlaylistLabel = styled.div<{ $hovered?: boolean }>`
  color: #1DB954;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  margin-right: 18px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.10);
  transition: color 0.2s;
  ${({ $hovered }) => $hovered && `
    color: #fff;
  `}
`;

const SwitchText = styled.span`
  color: #1DB954;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  margin-right: 18px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.10);
  transition: color 0.2s;
`;

const PlaylistCover = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 2px 12px rgba(0,0,0,0.18);
  background: #232323;
`;

const PlaylistTitle = styled.div`
  color: #fff;
  font-weight: bold;
  font-size: 1.5rem;
  text-align: left;
  max-width: 320px;
  word-break: break-word;
`;

// Add a flex container for home content
const HomeContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  width: 100%;
  margin-top: 0;
  padding: 48px 24px 0 24px;
  @media (max-width: 600px) {
    min-height: 100vh;
    margin-top: 0;
    justify-content: flex-start;
    padding: 48px 10px 0 10px;
  }
`;

const AppDescription = styled.p`
  color: #fff;
  font-size: 2rem;
  text-align: center;
  width: 100%;
  opacity: 0.92;
  font-weight: 300;
  letter-spacing: 0.5px;
  margin: 48px 0 0 0;
  padding: 0 20px;
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
  @media (max-width: 600px) {
    font-size: 1.25rem;
    padding: 0 8px;
    margin: 28px 0 0 0;
  }
`;

const ShimmeringLogo = styled.h1`
  color: #1DB954;
  font-size: 6.5rem;
  margin-bottom: 0;
  font-weight: 900;
  letter-spacing: 2px;
  text-shadow: 0 2px 12px rgba(0,0,0,0.08);
  background: linear-gradient(
    90deg,
    #1DB954 0%,
    #1ed760 25%,
    #ffffff 50%,
    #1ed760 75%,
    #1DB954 100%
  );
  background-size: 300% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shine 4s ease-in-out infinite;
  text-align: center;
  width: 100%;
  pointer-events: none;
  margin-top: 0;
  @media (max-width: 600px) {
    font-size: 2.2rem;
    margin-bottom: 0;
    margin-top: 0;
  }
`;

const GetStartedButton = styled(Button)`
  font-size: 2.6rem;
  padding: 36px 64px;
  margin-top: 72px;
  background: linear-gradient(45deg, #1DB954, #1ed760);
  box-shadow: 0 4px 15px rgba(29, 185, 84, 0.3);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(29, 185, 84, 0.4);
    background: linear-gradient(45deg, #1ed760, #1DB954);
  }
  @media (max-width: 600px) {
    font-size: 1.5rem;
    padding: 18px 0;
    width: 80vw;
    margin-top: 40px;
  }
`;

const OptionsButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(25, 25, 25, 0.0);
  border: 2px solid #1DB954;
  color: #1DB954;
  padding: 14px 32px;
  border-radius: 18px;
  cursor: pointer;
  font-size: 1.3rem;
  transition: all 0.3s ease;
  z-index: 2000;
  pointer-events: auto;
  &:hover {
    background: #1DB954;
    color: white;
  }
  @media (max-width: 600px) {
    padding: 8px 16px;
    font-size: 1rem;
    top: 8px;
    right: 8px;
  }
`;

const OptionsModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 70px;
  right: 20px;
  background: rgba(25, 25, 25, 0.95);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid #1DB954;
  z-index: 2000;
  opacity: ${props => props.$isOpen ? 1 : 0};
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
  transform: translateY(${props => props.$isOpen ? '0' : '-10px'});
  transition: all 0.3s ease;
`;

const BetaButton = styled(Button)`
  font-size: 1.5rem;
  padding: 18px 36px;
  margin-top: 32px;
  background: linear-gradient(45deg, #1ed760, #1DB954);
  box-shadow: 0 2px 8px rgba(29, 185, 84, 0.18);
  border: 2px dashed #1DB954;
  &:hover {
    background: linear-gradient(45deg, #1DB954, #1ed760);
    border-style: solid;
  }
`;

const PlaylistPickerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 80px;
  @media (max-width: 600px) {
    margin-top: 24px;
    width: 100vw;
    padding: 0;
  }
`;

// Add a divider for the header
const PlaylistPickerHeader = styled.h2`
  color: #1DB954;
  margin-bottom: 24px;
  font-size: 2.1rem;
  font-weight: 800;
  text-align: center;
  letter-spacing: 0.5px;
  @media (max-width: 600px) {
    font-size: 1.4rem;
    margin-bottom: 12px;
    margin-top: 0;
  }
`;

const PlaylistsScrollBox = styled.div`
  width: 420px;
  max-height: 500px;
  overflow-y: auto;
  background: rgba(0,0,0,0.25);
  border-radius: 18px;
  border: 2px solid #1DB954;
  padding: 24px 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  @media (max-width: 600px) {
    width: 95vw;
    min-width: 0;
    max-width: 95vw;
    padding: 8px 0;
    border-radius: 12px;
  }
`;

const PlaylistItem = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 32px;
  cursor: pointer;
  border-bottom: 1px solid #232323;
  transition: background 0.2s;
  &:hover {
    background: #232323;
  }
  @media (max-width: 600px) {
    padding: 10px 10px;
    gap: 10px;
  }
`;

const PlaylistCoverSmall = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 10px;
  object-fit: cover;
  background: #232323;
  @media (max-width: 600px) {
    width: 38px;
    height: 38px;
    border-radius: 7px;
  }
`;

const PlaylistName = styled.div`
  color: #fff;
  font-size: 1.2rem;
  font-weight: 600;
  @media (max-width: 600px) {
    font-size: 1rem;
    font-weight: 700;
  }
`;

const PlaylistTracks = styled.div`
  color: #1DB954;
  font-size: 1rem;
  font-weight: 400;
  @media (max-width: 600px) {
    font-size: 0.9rem;
  }
`;

// Add SpotifyPlaylist type for the beta picker
interface Song {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url?: string;
}

interface SwipeableCardProps {
  song: Song;
  onSwipe: (direction: string) => void;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({ song, onSwipe }) => {
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (e: SwipeEventData) => {
      const transform = `translateX(${e.deltaX}px) rotate(${e.deltaX * 0.1}deg)`;
      const card = document.querySelector('.song-card') as HTMLElement;
      if (card) {
        card.style.transform = transform;
      }
      // Show indicators based on swipe direction with larger neutral zone
      if (e.deltaX < -100) {
        setShowLeftIndicator(true);
        setShowRightIndicator(false);
      } else if (e.deltaX > 100) {
        setShowRightIndicator(true);
        setShowLeftIndicator(false);
      } else {
        setShowLeftIndicator(false);
        setShowRightIndicator(false);
      }
    },
    onSwipedLeft: () => {
      const card = document.querySelector('.song-card') as HTMLElement;
      if (card) {
        card.style.transform = 'translateX(-100vw) rotate(-30deg)';
        setTimeout(() => onSwipe('left'), 300);
      }
      setShowLeftIndicator(false);
    },
    onSwipedRight: () => {
      const card = document.querySelector('.song-card') as HTMLElement;
      if (card) {
        card.style.transform = 'translateX(100vw) rotate(30deg)';
        setTimeout(() => onSwipe('right'), 300);
      }
      setShowRightIndicator(false);
    },
    onSwiped: () => {
      setShowLeftIndicator(false);
      setShowRightIndicator(false);
    },
    trackMouse: true,
    delta: 40,
    touchEventOptions: { passive: false },
    preventScrollOnSwipe: true,
    trackTouch: true,
    rotationAngle: 0
  });

  return (
    <div {...handlers}>
      <SongCard className="song-card">
        <SwipeIndicator direction="left" style={{ opacity: showLeftIndicator ? 1 : 0 }}>
          Remove
        </SwipeIndicator>
        <SwipeIndicator direction="right" style={{ opacity: showRightIndicator ? 1 : 0 }}>
          Keep
        </SwipeIndicator>
        <AlbumArt src={song.album.images[0]?.url} alt={song.album.name} />
        <SongInfo>
          <Title>{song.name}</Title>
          <Artist>{song.artists && Array.isArray(song.artists) ? song.artists.map((artist: { name: string }) => artist.name).join(', ') : 'Unknown Artist'}</Artist>
        </SongInfo>
      </SongCard>
    </div>
  );
};

interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { id: string };
  collaborative: boolean;
}

interface PlaylistPickerBetaProps {
  token: string;
  onSelect: (pl: SpotifyPlaylist) => void;
  onBack: () => void;
}

function PlaylistPickerBeta({ token, onSelect, onBack }: PlaylistPickerBetaProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    // Fetch user ID first
    axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(userRes => {
        setUserId(userRes.data.id);
        // Now fetch playlists
        return axios.get('https://api.spotify.com/v1/me/playlists?limit=50', {
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then(res => {
        setPlaylists(res.data.items || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load playlists.');
        setLoading(false);
      });
  }, [token]);

  // Only show playlists owned by the user or collaborative playlists
  const editablePlaylists = userId ? playlists.filter(pl => pl.owner?.id === userId || pl.collaborative) : [];

  return (
    <PlaylistPickerContainer>
      <PlaylistPickerHeader>Choose a Playlist (Beta)</PlaylistPickerHeader>
      {loading && <div style={{ color: '#fff' }}>Loading...</div>}
      {error && <div style={{ color: '#ff4b4b' }}>{error}</div>}
      <PlaylistsScrollBox>
        {editablePlaylists.map((pl) => (
          <PlaylistItem key={pl.id} onClick={() => onSelect(pl)}>
            <PlaylistCoverSmall src={pl.images?.[0]?.url} alt={pl.name} />
            <div>
              <PlaylistName>{pl.name}</PlaylistName>
              <PlaylistTracks>{pl.tracks?.total || 0} tracks</PlaylistTracks>
            </div>
          </PlaylistItem>
        ))}
        {(!loading && editablePlaylists.length === 0) && (
          <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
            No editable playlists found.<br />You can only edit playlists you own or collaborate on.
          </div>
        )}
      </PlaylistsScrollBox>
      <BetaButton style={{ marginTop: 32 }} onClick={onBack}>Back</BetaButton>
    </PlaylistPickerContainer>
  );
}

// Extracted LoadingSpinner component
const LoadingSpinner = () => (
  <>
    <div style={{ border: '6px solid #232323', borderTop: '6px solid #1DB954', borderRadius: '50%', width: 60, height: 60, animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </>
);

// Extracted SongList component
const SongList: React.FC<{ songs: Song[] }> = ({ songs }) => (
  <ul>
    {songs.map((song) => {
      const artistNames = song.artists && Array.isArray(song.artists)
        ? song.artists.map((artist: { name: string }) => artist.name).join(', ')
        : 'Unknown Artist';
      const albumArtUrl = song.album?.images?.[0]?.url || '';
      return (
        <li key={song.id}>
          {albumArtUrl && <img src={albumArtUrl} alt={song.album?.name || 'Album art'} />}
          <div>
            <strong>{song.name}</strong> by {artistNames}
          </div>
        </li>
      );
    })}
  </ul>
);

const BetaNotice = styled.div`
  background: linear-gradient(90deg, #1DB954 0%, #1ed760 100%);
  color: #191414;
  font-weight: bold;
  font-size: 1rem;
  padding: 4px 18px;
  border-radius: 16px;
  margin: 18px 0 0 0;
  letter-spacing: 1px;
  box-shadow: 0 2px 8px rgba(29,185,84,0.10);
  display: inline-block;
`;

// Add a flex container for the floating panel buttons on mobile
const FloatingPanelButtonRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 90px;
  z-index: 3001;
  @media (min-width: 601px) {
    display: none;
  }
`;

// Slide-in panel for mobile
const SlidePanel = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: auto;
  margin: 0 auto;
  width: 100vw;
  max-width: 540px;
  background: rgba(25,25,25,0.98);
  z-index: 4001;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  padding: 0;
  height: 60vh;
  min-height: 120px;
  overflow: hidden;
  transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
  &.open {
    transform: translateY(0);
  }
  @media (min-width: 601px) {
    display: none;
  }
`;

const SlidePanelHeader = styled.div`
  width: 100%;
  padding: 20px 0 12px 0;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 800;
  color: #1DB954;
  background: transparent;
  position: relative;
`;

const SlidePanelClose = styled.button`
  background: none;
  color: #1DB954;
  border: none;
  font-size: 2.2rem;
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 2;
  cursor: pointer;
  line-height: 1;
  padding: 0 8px;
  @media (min-width: 601px) {
    display: none;
  }
`;

const CompactSongList = styled.ul`
  width: 100%;
  max-width: 500px;
  padding: 0 0 12px 0;
  margin: 0;
  list-style: none;
  overflow-y: auto;
  max-height: calc(60vh - 60px);
  @media (max-width: 600px) {
    max-width: 500px;
    padding: 0 8px 12px 8px;
  }
  li {
    display: flex;
    align-items: center;
    background: #232323;
    padding: 10px 8px;
    margin-bottom: 0;
    border-radius: 7px;
    font-size: 15px;
    border-bottom: 1px solid #333;
    &:last-child {
      border-bottom: none;
    }
    img {
      width: 38px;
      height: 38px;
      object-fit: cover;
      border-radius: 5px;
      margin-right: 12px;
    }
    div {
      flex: 1;
      display: flex;
      flex-direction: column;
      white-space: normal;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .song-title {
      font-weight: 700;
      color: #fff;
      font-size: 1.05em;
      margin-bottom: 2px;
      line-height: 1.2;
    }
    .song-artists {
      color: #b3b3b3;
      font-size: 0.98em;
      font-weight: 400;
      line-height: 1.1;
    }
  }
`;

// Add floating panel button style for mobile (move this above App function and before FloatingPanelButtonRow)
const FloatingPanelButton = styled.button`
  background: #1DB954;
  color: #fff;
  border: none;
  border-radius: 24px;
  padding: 12px 22px;
  font-size: 1.1rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(29,185,84,0.18);
  cursor: pointer;
  transition: background 0.2s;
  flex: 1 1 0;
  max-width: 48%;
  min-width: 0;
  text-align: center;
  opacity: 1;
  @media (max-width: 600px) {
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  @media (min-width: 601px) {
    display: none;
  }
`;

// Add a mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function App() {
  const [showRemovedPanel, setShowRemovedPanel] = useState(false);
  const [showKeptPanel, setShowKeptPanel] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string>('');
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [removedSongsStack, setRemovedSongsStack] = useState<Song[]>([]);
  const [swipeActionHistory, setSwipeActionHistory] = useState<{ song: Song; direction: 'left' | 'right' }[]>([]);
  const [keptSongsList, setKeptSongsList] = useState<Song[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [currentSongName, setCurrentSongName] = useState<string | null>(null);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(() => {
    const stored = localStorage.getItem('showEmbed');
    return stored === null ? false : stored === 'true';
  });
  const [playlistName, setPlaylistName] = useState<string>('');
  const [playlistImage, setPlaylistImage] = useState<string>(''); // New state for playlist image
  const [playlistHeaderHovered, setPlaylistHeaderHovered] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showPlaylistPickerBeta, setShowPlaylistPickerBeta] = useState(false);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const isMobile = useIsMobile();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !localStorage.getItem('token')) {
      const codeVerifier = localStorage.getItem('pkce_code_verifier');
      if (codeVerifier) {
        fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier,
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.access_token) {
              localStorage.setItem('token', data.access_token);
              setToken(data.access_token);
              localStorage.removeItem('pkce_code_verifier');
              window.history.replaceState({}, document.title, window.location.pathname);
            } else {
              console.error('Token exchange failed:', data);
            }
            setInitialLoading(false);
          })
          .catch(error => {
            console.error('Error exchanging code for token:', error);
            setInitialLoading(false);
          });
      } else {
        console.error('PKCE code verifier not found in local storage.');
        setInitialLoading(false);
      }
    } else {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
      setInitialLoading(false);
    }
  }, []);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    console.log('Attempting to set up Spotify Web Playback SDK ready handler.');
    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('Spotify Web Playback SDK is ready.');
      if (!window.Spotify) {
        console.error('Spotify object not found on window.');
        return;
      }
      console.log('Spotify object found on window.', window.Spotify);
      const token = localStorage.getItem('token');
      if (token) {
        const player = new window.Spotify.Player({
          name: 'TrackSwipe',
          getOAuthToken: (cb: (token: string) => void) => { cb(token); },
          volume: 0.5
        });

        // Ready
        player.on('ready', ({ device_id }: { device_id: string }) => {
          console.log('Ready with Device ID', device_id);
        });

        // Not Ready
        player.on('not_ready', ({ device_id }: { device_id: string }) => {
          console.log('Device ID has gone offline', device_id);
        });

        // Error handling
        player.on('initialization_error', ({ message }: { message: string }) => { console.error(message); });
        player.on('authentication_error', ({ message }: { message: string }) => { console.error(message); });
        player.on('account_error', ({ message }: { message: string }) => { console.error(message); });
        player.on('playback_error', ({ message }: { message: string }) => { console.error(message); });

        console.log('Attempting to connect the Spotify player.');
        player.connect();
        setPlayer(player);
      }
    };

    return () => {
      // Clean up the player when the component unmounts
      if (player) {
        player.disconnect();
      }
    };
  }, [token]); // Re-run if token changes

  const playSong = (spotifyUri: string) => {
    console.log('playSong called with URI:', spotifyUri);
    if (player) {
      console.log('Spotify player is available.');
      player.activateElement().then(() => {
        player.getCurrentState().then((state: any) => {
          if (!state) {
            console.error('Spotify player state is null. Make sure the player is active and Spotify is open.');
            // Optionally, show a user-friendly message here
            return;
          }
          const { device_id } = state; // Use the active device_id
          console.log('Attempting to play on device ID:', device_id);
          console.log('Making fetch call to Spotify playback endpoint...');
          fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uris: [spotifyUri] })
          })
          .then(response => {
            console.log('Spotify playback API response status:', response.status);
            if (!response.ok) {
              // Handle errors, e.g., premium required
              console.error('Failed to start playback', response);
            }
          })
          .catch(error => {
            console.error('Error during playback request:', error);
          });
        }).catch((error: any) => console.error('Error getting player state:', error));
      }).catch((error: any) => console.error('Error activating element:', error));
    } else {
      console.error('Spotify player not initialized.');
    }
  };

  const handleLogin = async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('pkce_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code', // Important for PKCE
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: FULL_SCOPE,
    });

    window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('pkce_code_verifier');
    setPlaylistId('');
    setSongs([]);
    setCurrentIndex(0);
    setRemovedSongsStack([]);
    setSwipeActionHistory([]);
    setKeptSongsList([]);
    if (player) {
      player.disconnect();
      setPlayer(null);
    }
  };

  const extractPlaylistId = (url: string) => {
    // Handle different Spotify URL formats
    const patterns = [
      /playlist\/([a-zA-Z0-9]+)/,  // spotify:playlist:ID or https://open.spotify.com/playlist/ID
      /spotify:playlist:([a-zA-Z0-9]+)/,  // spotify:playlist:ID
      /^([a-zA-Z0-9]+)$/  // Just the ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return url; // Return original input if no pattern matches
  };

  // Update fetchPlaylistSongs to set loadingSongs
  const fetchPlaylistSongs = async (customPlaylistId?: string) => {
    const idToFetch = customPlaylistId || playlistId;
    setLoadingSongs(true);
    console.log('fetchPlaylistSongs called');
    console.log('Current Token:', token ? 'Present' : 'Missing');
    console.log('Current Playlist ID:', idToFetch);

    if (!token || !idToFetch) {
      setLoadingSongs(false);
      console.log('Token or Playlist ID missing. Returning.');
      return;
    }

    try {
      const response = await axios.get(`https://api.spotify.com/v1/playlists/${idToFetch}/tracks`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch playlist details for the name and image
      const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${idToFetch}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylistName(playlistResponse.data.name || '');
      setPlaylistImage(
        playlistResponse.data.images && playlistResponse.data.images.length > 0
          ? playlistResponse.data.images[0].url
          : ''
      );

      if (response.data && Array.isArray(response.data.items)) {
        setSongs(response.data.items
          .map((item: any) => item.track)
          .filter((track: any) => track && track.id));
      } else {
        setSongs([]);
      }
    } catch (error) {
      setSongs([]);
      setPlaylistName('');
      setPlaylistImage('');
    } finally {
      setLoadingSongs(false);
    }
  };

  // Use useMemo for currentSong
  const currentSong = useMemo(() => songs[currentIndex], [songs, currentIndex]);

  // Use useCallback for handlers
  const handleSwipe = useCallback(async (direction: string) => {
    console.log('Swiped: ' + direction);
    const swipedSong = songs[currentIndex];
    setSwipeActionHistory(prevHistory => [...prevHistory, { song: swipedSong, direction: direction as 'left' | 'right' }]);
    if (direction === 'left') {
      setRemovedSongsStack(prev => [...prev, swipedSong]);
    } else if (direction === 'right') {
      console.log('Song kept:', swipedSong.name);
      setKeptSongsList(prev => [...prev, swipedSong]);
    }
    setCurrentIndex(prevIndex => prevIndex + 1);
  }, [songs, currentIndex]);

  const handleUndo = useCallback(async () => {
    if (swipeActionHistory.length === 0) {
      console.log('No actions to undo.');
      return;
    }
    const lastAction = swipeActionHistory[swipeActionHistory.length - 1];
    const songToUndo = lastAction.song;
    const lastSwipeDirection = lastAction.direction;
    setSwipeActionHistory(prevHistory => prevHistory.slice(0, -1));
    setCurrentIndex(prevIndex => prevIndex - 1);
    if (lastSwipeDirection === 'left') {
      setRemovedSongsStack(prev => prev.filter(song => song.id !== songToUndo.id));
      console.log('Undo: Song removed from removedSongsStack:', songToUndo.name);
      if (!token || !playlistId || !songToUndo) {
        console.error('Cannot add song back to Spotify: Missing token, playlist ID, or song data.');
      } else {
        try {
          await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            uris: [`spotify:track:${songToUndo.id}`]
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          console.log('Song added back to playlist on Spotify:', songToUndo.name);
        } catch (error) {
          console.error('Error adding song back to Spotify:', error);
        }
      }
    } else if (lastSwipeDirection === 'right') {
      setKeptSongsList(prev => prev.filter(song => song.id !== songToUndo.id));
      console.log('Undo: Song removed from keptSongsList:', songToUndo.name);
    }
  }, [swipeActionHistory, token, playlistId]);

  const applyRemovals = async () => {
    if (!token || !playlistId || removedSongsStack.length === 0) {
      console.log('Cannot apply removals: Missing token, playlist ID, or no songs to remove.');
      return;
    }

    console.log(`Applying removals for ${removedSongsStack.length} songs...`);
    try {
      // Spotify API allows removing multiple tracks in one call (up to 100)
      // Construct the array of tracks to remove
      const tracksToRemove = removedSongsStack.map(song => ({ uri: `spotify:track:${song.id}` }));

      await axios.delete(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        data: { // DELETE request body should be in the 'data' property with Axios
          tracks: tracksToRemove
        }
      });

      console.log('All pending removals applied successfully!');
      // Clear the stack after successful removal
      setRemovedSongsStack([]);
      // Note: swipeActionHistory is not cleared here as it tracks all actions, not just removals
      // Also clear undo history as removals are now applied
      setSwipeActionHistory([]);

    } catch (error) {
      console.error('Error applying removals:', error);
      // Optionally, handle partial failures or provide user feedback
    }
  };

  const handlePlayPreview = (song: Song) => {
    if (!song.preview_url) return;
    const audio = audioRef.current;
    if (!audio) return;

    // If clicking the same song, toggle pause/play
    if (playingPreviewId === song.id) {
      if (!audio.paused) {
        audio.pause();
      } else {
        audio.play().catch(err => {
          console.warn('Audio play failed:', err);
        });
      }
    } else {
      setPlayingPreviewId(song.id);
      // Set src and play
      audio.src = song.preview_url;
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn('Audio play failed:', err);
      });
    }
  };

  useEffect(() => {
    if (playingPreviewId && audioRef.current) {
      // Try to play when preview changes
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        // Some browsers require user interaction
        console.warn('Audio play failed:', err);
      });
    }
  }, [playingPreviewId]);

  // Fetch and log the song name from Spotify API when currentSong changes
  useEffect(() => {
    if (currentSong && token) {
      console.log('Current card song id:', currentSong.id);

      // Fetch song details from Spotify API
      axios.get(`https://api.spotify.com/v1/tracks/${currentSong.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then(response => {
        if (response.data && response.data.name) {
          console.log('Fetched song name from Spotify API:', response.data.name);
          setCurrentSongName(response.data.name);
          setCurrentSongId(response.data.id);
        } else {
          console.log('Could not fetch song name from Spotify API.');
          setCurrentSongName(null);
          setCurrentSongId(null);
        }
      })
      .catch(error => {
        console.error('Error fetching song from Spotify API:', error);
        setCurrentSongName(null);
        setCurrentSongId(null);
      });
    } else {
      setCurrentSongName(null);
      setCurrentSongId(null);
    }
  }, [currentSong, token]);

  useEffect(() => {
    localStorage.setItem('showEmbed', showEmbed.toString());
  }, [showEmbed]);

  // Add a styled loading container
  const LoadingContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    width: 100vw;
    font-size: 2rem;
    color: #1DB954;
    background: #191414;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 3000;
  `;

  if (initialLoading) {
    return (
      <LoadingContainer>
        <div style={{ marginBottom: 24 }}>Loading...</div>
        <LoadingSpinner />
      </LoadingContainer>
    );
  }

  if (!token) {
    return (
      <AppContainer>
        <HomeContent>
          <ShimmeringLogo>TrackSwipe</ShimmeringLogo>
          <BetaNotice>Beta</BetaNotice>
          <AppDescription>
            Swipe through your Spotify playlists to curate the perfect collection
          </AppDescription>
          <GetStartedButton onClick={() => handleLogin()}>
            Get Started
          </GetStartedButton>
        </HomeContent>
        <OptionsButton onClick={() => setShowOptions(!showOptions)}>
          Options
        </OptionsButton>
        <OptionsModal $isOpen={showOptions}>
          <div style={{ marginBottom: 16, fontSize: 20, color: '#fff' }}>
            Options
          </div>
          <label style={{ color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              checked={showEmbed}
              onChange={() => setShowEmbed(v => !v)}
              style={{ accentColor: '#1DB954', width: 20, height: 20 }}
            />
            Show Spotify Embed Player
          </label>
        </OptionsModal>
      </AppContainer>
    );
  }

  if (showPlaylistPickerBeta && token) {
    return (
      <AppContainer>
        <PlaylistPickerBeta
          token={token}
          onSelect={(pl) => {
            setPlaylistId(pl.id);
            setPlaylistName(pl.name);
            setPlaylistImage(pl.images?.[0]?.url || '');
            setShowPlaylistPickerBeta(false);
            fetchPlaylistSongs(pl.id); // Pass the selected playlist's ID directly
          }}
          onBack={() => setShowPlaylistPickerBeta(false)}
        />
        <TransparentLogoutButton onClick={logout}>Logout</TransparentLogoutButton>
      </AppContainer>
    );
  }

  return (
    <StyleSheetManager>
      {/* TopBar with Undo (left) and Logout (right) */}
      <TopBar>
        <div>
          {swipeActionHistory.length > 0 && (
            <TopBarButton
              onClick={() => handleUndo()}
              disabled={swipeActionHistory.length === 0}
            >
              Undo ({swipeActionHistory.length})
            </TopBarButton>
          )}
        </div>
      </TopBar>
      {songs.length > 0 && (
        <Logo>TrackSwipe</Logo>
      )}
      <AppContainer>
        {songs.length === 0 ? (
          loadingSongs ? (
            <LoadingContainer>
              <div style={{ marginBottom: 24 }}>Loading playlist...</div>
              <LoadingSpinner />
            </LoadingContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '120px' }}>
              <PlaylistInput
                type="text"
                placeholder="Paste Spotify playlist URL or ID"
                value={playlistUrl}
                onChange={(e) => {
                  setPlaylistUrl(e.target.value);
                  setPlaylistId(extractPlaylistId(e.target.value));
                }}
              />
              <LoadPlaylistButton onClick={() => fetchPlaylistSongs()} disabled={!playlistId}>Load Playlist</LoadPlaylistButton>
              <BetaButton onClick={() => setShowPlaylistPickerBeta(true)}>
                Try Playlist Picker (Beta)
              </BetaButton>
            </div>
          )
        ) : (
          <>
            {playlistName && (
              <PlaylistHeaderButton
                onMouseEnter={() => setPlaylistHeaderHovered(true)}
                onMouseLeave={() => setPlaylistHeaderHovered(false)}
                onClick={() => {
                  setSongs([]);
                  setPlaylistId('');
                  setPlaylistUrl('');
                  setPlaylistName('');
                  setPlaylistImage('');
                  setCurrentIndex(0);
                  setRemovedSongsStack([]);
                  setSwipeActionHistory([]);
                  setKeptSongsList([]);
                }}
                title="Switch playlist"
              >
                {playlistHeaderHovered ? (
                  <SwitchText>Switch?</SwitchText>
                ) : (
                  <PlaylistLabel>Playlist:</PlaylistLabel>
                )}
                {playlistImage && (
                  <PlaylistCover
                    src={playlistImage}
                    alt="Playlist cover"
                  />
                )}
                <PlaylistTitle>{playlistName}</PlaylistTitle>
              </PlaylistHeaderButton>
            )}
            <MainContent>
              {/* Desktop lists */}
              {removedSongsStack.length > 0 && (
                <RemovedSongsList isScrollable={removedSongsStack.length > 10}>
                  <h3>Removed Tracks:</h3>
                  <SongList songs={removedSongsStack} />
                </RemovedSongsList>
              )}
              {keptSongsList.length > 0 && (
                <KeptSongsList isScrollable={keptSongsList.length > 10}>
                  <h3>Kept Tracks:</h3>
                  <SongList songs={keptSongsList} />
                </KeptSongsList>
              )}
              {/* Mobile floating buttons */}
              {isMobile && (
                <>
                  <FloatingPanelButtonRow>
                    <FloatingPanelButton
                      onClick={() => setShowRemovedPanel(true)}
                      disabled={removedSongsStack.length === 0}
                    >
                      Show Removed
                    </FloatingPanelButton>
                    <FloatingPanelButton
                      onClick={() => setShowKeptPanel(true)}
                      disabled={keptSongsList.length === 0}
                    >
                      Show Kept
                    </FloatingPanelButton>
                  </FloatingPanelButtonRow>
                  {showRemovedPanel && <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',zIndex:3999,background:'rgba(0,0,0,0.01)'}} onClick={()=>setShowRemovedPanel(false)} />}
                  <SlidePanel className={showRemovedPanel ? 'open' : ''}>
                    <SlidePanelClose onClick={() => setShowRemovedPanel(false)}>
                      {'\\'}
                    </SlidePanelClose>
                    <SlidePanelHeader>Removed Tracks</SlidePanelHeader>
                    {removedSongsStack.length > 0 ? (
                      <CompactSongList>
                        {removedSongsStack.map(song => (
                          <li key={song.id}>
                            {song.album?.images?.[0]?.url && <img src={song.album.images[0].url} alt={song.album.name || 'Album art'} />}
                            <div><span className="song-title">{song.name}</span><span className="song-artists">{song.artists.map(a => a.name).join(', ')}</span></div>
                          </li>
                        ))}
                      </CompactSongList>
                    ) : <div style={{ color: '#fff', marginTop: 24 }}>No removed songs.</div>}
                  </SlidePanel>
                  {showKeptPanel && <div style={{position:'fixed',left:0,top:0,width:'100vw',height:'100vh',zIndex:3999,background:'rgba(0,0,0,0.01)'}} onClick={()=>setShowKeptPanel(false)} />}
                  <SlidePanel className={showKeptPanel ? 'open' : ''}>
                    <SlidePanelClose onClick={() => setShowKeptPanel(false)}>
                      {'\\'}
                    </SlidePanelClose>
                    <SlidePanelHeader>Kept Tracks</SlidePanelHeader>
                    {keptSongsList.length > 0 ? (
                      <CompactSongList>
                        {keptSongsList.map(song => (
                          <li key={song.id}>
                            {song.album?.images?.[0]?.url && <img src={song.album.images[0].url} alt={song.album.name || 'Album art'} />}
                            <div><span className="song-title">{song.name}</span><span className="song-artists">{song.artists.map(a => a.name).join(', ')}</span></div>
                          </li>
                        ))}
                      </CompactSongList>
                    ) : <div style={{ color: '#fff', marginTop: 24 }}>No kept songs.</div>}
                  </SlidePanel>
                </>
              )}
              <CardAndButtonContainer>
                <CardContainer>
                  {currentSong && (
                    <SwipeableCard
                      key={currentSong.id}
                      song={currentSong}
                      onSwipe={handleSwipe}
                    />
                  )}
                  {currentIndex >= songs.length && (
                    <div style={{ color: 'white', textAlign: 'center', marginTop: '40px', fontSize: '1.2em' }}>
                      No more songs in this playlist!
                    </div>
                  )}
                </CardContainer>
                {showEmbed && currentSongId && (
                  <div style={{ marginTop: 32, marginBottom: 16 }}>
                    <iframe
                      src={`https://open.spotify.com/embed/track/${currentSongId}`}
                      width="340"
                      height="80"
                      frameBorder="0"
                      allow="encrypted-media"
                      title="Spotify Player"
                      style={{ borderRadius: 12, width: '98vw', maxWidth: 400, margin: '12px auto 0 auto', display: 'block' }}
                    />
                  </div>
                )}
                {removedSongsStack.length > 0 && (
                  <ApplyButton onClick={() => applyRemovals()} disabled={removedSongsStack.length === 0} style={{ marginTop: 24 }}>
                    Apply {removedSongsStack.length} Removal{removedSongsStack.length > 1 ? 's' : ''}
                  </ApplyButton>
                )}
              </CardAndButtonContainer>
            </MainContent>
          </>
        )}
      </AppContainer>
      <TransparentLogoutButton onClick={logout}>Logout</TransparentLogoutButton>
    </StyleSheetManager>
  );
}

export default App;