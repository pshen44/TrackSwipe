import React, { useState, useEffect } from 'react';
import styled, { StyleSheetManager } from 'styled-components';
import axios from 'axios';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';
import { useSwipeable, SwipeEventData } from 'react-swipeable';
import isPropValid from '@emotion/is-prop-valid';

// Filter out the 'isScrollable' prop from being passed to the DOM element
const shouldForwardProp = (prop: string) => isPropValid(prop) && prop !== 'isScrollable';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

const CLIENT_ID = '06b9dadfd2144324a7ed4d37dbe1245f'; // Replace with your Spotify Client ID
const REDIRECT_URI = 'http://127.0.0.1:3000'; // Make sure this matches your Spotify app settings
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SCOPE = 'playlist-read-private playlist-modify-private playlist-modify-public';

const SCOPE_PLAYBACK = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';

const FULL_SCOPE = `${SCOPE} ${SCOPE_PLAYBACK}`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(to bottom, #1DB954, #191414);
  padding: 20px;
  box-sizing: border-box;
  max-width: 100vw;
  max-height: 100vh;
  overflow-x: hidden;
`;

const CardContainer = styled.div`
  width: 300px;
  height: 400px;
  position: relative;
  margin: 20px;
  transform: translateZ(0);
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  margin-top: 20px;
  position: relative;
`;

const SongCard = styled.div<{ transform?: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 300px;
  height: 400px;
  transition: transform 0.3s ease-out;
  transform: ${props => props.transform || 'none'};
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  border: 2px solid transparent;
  &:hover {
    border-color: #1DB954;
  }
`;

const SongInfo = styled.div`
  text-align: center;
`;

const Title = styled.h2`
  margin: 0;
  color: #191414;
`;

const Artist = styled.p`
  color: #666;
  margin: 10px 0;
`;

const AlbumArt = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 10px;
  margin: 10px 0;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  pointer-events: none;
`;

const PlayButton = styled.button`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7); /* Semi-transparent background */
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 2; /* Ensure it's above the card */

  &:hover {
    background: rgba(0, 0, 0, 0.9); /* Darker on hover */
  }
`;

const Button = styled.button`
  background: #1DB954;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 16px;
  margin: 10px;
  
  &:hover {
    background: #1ed760;
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
  padding: 10px;
  margin: 10px;
  width: 300px;
  border-radius: 20px;
  border: 2px solid #1DB954;
  font-size: 16px;
  &:focus {
    outline: none;
    border-color: #1ed760;
  }
`;

const RemovedSongsList = styled.div<{isScrollable?: boolean}>`
  margin-top: 20px;
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
`;

const KeptSongsList = styled.div<{isScrollable?: boolean}>`
  margin-top: 20px;
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
  align-items: center; /* Center the card and button horizontally */
`;

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
  onPlayClick: () => void;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({ song, onSwipe, onPlayClick }) => {
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);

  const handlePlayClick = () => {
    // This will be handled in the parent component (App) via context or prop drilling
    // For now, it's a placeholder.
  };

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
    delta: 1,
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
          <Artist>{song.artists && Array.isArray(song.artists) ? song.artists.map(artist => artist.name).join(', ') : 'Unknown Artist'}</Artist>
        </SongInfo>
        <PlayButton onClick={onPlayClick}>▶</PlayButton>
        {song.preview_url && (
          <audio controls src={song.preview_url} style={{ width: '100%', marginTop: '10px' }}>
            Your browser does not support the audio element.
          </audio>
        )}
      </SongCard>
    </div>
  );
};

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string>('');
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [removedSongsStack, setRemovedSongsStack] = useState<Song[]>([]);
  const [swipeActionHistory, setSwipeActionHistory] = useState<{ song: Song; direction: 'left' | 'right' }[]>([]);
  const [keptSongsList, setKeptSongsList] = useState<Song[]>([]);
  const [player, setPlayer] = useState<any>(null);

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
          })
          .catch(error => {
            console.error('Error exchanging code for token:', error);
          });
      } else {
        console.error('PKCE code verifier not found in local storage.');
      }
    } else {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
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

  const fetchPlaylistSongs = async () => {
    console.log('fetchPlaylistSongs called');
    console.log('Current Token:', token ? 'Present' : 'Missing');
    console.log('Current Playlist ID:', playlistId);

    if (!token || !playlistId) {
      console.log('Token or Playlist ID missing. Returning.');
      return;
    }

    try {
      console.log('Making API call to fetch playlist tracks...');
      const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('API response received:', response);
      console.log('API response data:', response.data);

      if (response.data && Array.isArray(response.data.items)) {
        console.log('Number of tracks received:', response.data.items.length);
        if (response.data.items.length > 0) {
          setSongs(response.data.items
            .map((item: any) => item.track)
            .filter((track: any) => track && track.id)); // Only keep valid tracks with an id
          console.log('Songs state updated.');
        } else {
          console.log('Playlist is empty or no tracks found.');
          setSongs([]);
        }
      } else {
        console.error('Unexpected API response structure - missing or invalid items array:', response.data);
        setSongs([]);
      }

    } catch (error) {
      console.error('Error fetching playlist:', error);
      setSongs([]);
    }
  };

  const handleSwipe = async (direction: string) => {
    console.log('Swiped: ' + direction);
    const swipedSong = songs[currentIndex];

    // Record the swipe action in history
    setSwipeActionHistory(prevHistory => [...prevHistory, { song: swipedSong, direction: direction as 'left' | 'right' }]);

    if (direction === 'left') {
      // Add song to the stack of songs to be removed on apply
      setRemovedSongsStack(prev => [...prev, swipedSong]);
    } else if (direction === 'right') {
      console.log('Song kept:', swipedSong.name);
      // Add song to the kept songs list
      setKeptSongsList(prev => [...prev, swipedSong]);
    }
    // Always increment index after a swipe
    setCurrentIndex(prevIndex => prevIndex + 1);
  };

  const handleUndo = async () => {
    // Check if there is any action to undo
    if (swipeActionHistory.length === 0) {
      console.log('No actions to undo.');
      return;
    }

    // Get the last action from history
    const lastAction = swipeActionHistory[swipeActionHistory.length - 1];
    const songToUndo = lastAction.song;
    const lastSwipeDirection = lastAction.direction;

    // Remove the last action from history
    setSwipeActionHistory(prevHistory => prevHistory.slice(0, -1));

    // Decrement current index to go back to the previous song
    setCurrentIndex(prevIndex => prevIndex - 1);

    // If the last action was 'left' (remove), remove it from the removedSongsStack
    if (lastSwipeDirection === 'left') {
      // Remove the song from the removedSongsStack
      setRemovedSongsStack(prev => prev.filter(song => song.id !== songToUndo.id));
      console.log('Undo: Song removed from removedSongsStack:', songToUndo.name);
      // Attempt to add the song back to the playlist on Spotify
      if (!token || !playlistId || !songToUndo) {
        console.error('Cannot add song back to Spotify: Missing token, playlist ID, or song data.');
        // Optionally, inform the user that the Spotify update failed
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
          // Optionally, inform the user that the Spotify update failed
        }
      }
    } else if (lastSwipeDirection === 'right') {
      // Remove the song from the keptSongsList
      setKeptSongsList(prev => prev.filter(song => song.id !== songToUndo.id));
      console.log('Undo: Song removed from keptSongsList:', songToUndo.name);
    }
  };

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

  if (!token) {
    return (
      <AppContainer>
        <Button onClick={handleLogin}>
          Login to Spotify
        </Button>
      </AppContainer>
    );
  }

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <AppContainer>
        <Button onClick={logout}>Logout</Button>
        {swipeActionHistory.length > 0 && (
          <Button onClick={handleUndo} style={{ marginLeft: '10px' }} disabled={swipeActionHistory.length === 0}>Undo ({swipeActionHistory.length})</Button>
        )}
        
        {songs.length === 0 ? (
          <div>
            <PlaylistInput
              type="text"
              placeholder="Paste Spotify playlist URL or ID"
              value={playlistUrl}
              onChange={(e) => {
                setPlaylistUrl(e.target.value);
                setPlaylistId(extractPlaylistId(e.target.value));
              }}
            />
            <Button onClick={fetchPlaylistSongs} disabled={!playlistId}>Load Playlist</Button>
          </div>
        ) : (
          <>
            <MainContent>
              {removedSongsStack.length > 0 && (
                <RemovedSongsList isScrollable={removedSongsStack.length > 10}>
                  <h3>Removed Tracks:</h3>
                  <ul>
                    {removedSongsStack.map((song, index) => {
                      const artistNames = song.artists && Array.isArray(song.artists) ? song.artists.map(artist => artist.name).join(', ') : 'Unknown Artist';
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
                </RemovedSongsList>
              )}
              <CardAndButtonContainer>
                <CardContainer>
                  {songs.slice(currentIndex, currentIndex + 1).map((song) => (
                    <SwipeableCard
                      key={song.id}
                      song={song}
                      onSwipe={handleSwipe}
                      onPlayClick={() => playSong(`spotify:track:${song.id}`)}
                    />
                  ))}
                  {currentIndex >= songs.length && (
                    <div style={{ color: 'white', textAlign: 'center', marginTop: '40px', fontSize: '1.2em' }}>
                      No more songs in this playlist!
                    </div>
                  )}
                </CardContainer>
                {removedSongsStack.length > 0 && (
                  <ApplyButton onClick={applyRemovals} disabled={removedSongsStack.length === 0}>
                    Apply {removedSongsStack.length} Removal{removedSongsStack.length > 1 ? 's' : ''}
                  </ApplyButton>
                )}
              </CardAndButtonContainer>
              {keptSongsList.length > 0 && (
                <KeptSongsList isScrollable={keptSongsList.length > 10}>
                  <h3>Kept Tracks:</h3>
                  <ul>
                    {keptSongsList.map((song, index) => {
                      const artistNames = song.artists && Array.isArray(song.artists) ? song.artists.map(artist => artist.name).join(', ') : 'Unknown Artist';
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
                </KeptSongsList>
              )}
            </MainContent>
          </>
        )}
      </AppContainer>
    </StyleSheetManager>
  );
}

export default App; 