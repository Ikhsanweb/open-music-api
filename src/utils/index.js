/* eslint-disable object-curly-newline */
/* eslint-disable camelcase */
/* eslint-disable no-underscore-dangle */

const mapAlbumDBToModel = ({ id, name, year, coverUrl }) => ({
  id,
  name,
  year,
  coverUrl,
});

const mapSongDBToModel = ({
  id,
  title,
  year,
  performer,
  genre,
  duration,
  album_id,
}) => ({
  id,
  title,
  year,
  performer,
  genre,
  duration,
  albumId: album_id,
});

const mapPlaylistDBToModel = ({
  id,
  name,
  playlist_id,
  song_id,
  username,
  owner,
}) => ({
  id,
  name,
  playlistId: playlist_id,
  songId: song_id,
  username,
  owner,
});

module.exports = { mapAlbumDBToModel, mapSongDBToModel, mapPlaylistDBToModel };
