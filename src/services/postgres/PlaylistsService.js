/* eslint-disable no-underscore-dangle */

const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const { mapPlaylistDBToModel } = require('../../utils');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Playlist gagal ditambahkan');
    }

    await this._cacheService.delete(`playlists:${owner}`);
    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    try {
      // mendapatkan playlists dari cache
      const result = await this._cacheService.get(`playlists:${owner}`);
      return JSON.parse(result);
    } catch (error) {
      // bila gagal, diteruskan dengan mendapatkan playlists dari database
      const query = {
        text: `SELECT playlists.id, playlists.name, users.username FROM playlists
        LEFT JOIN users ON users.id = playlists.owner 
        WHERE playlists.owner = $1
        GROUP BY playlists.id, users.username`,
        values: [owner],
      };
      const result = await this._pool.query(query);
      // playlists akan disimpan pada cache sebelum fungsi get dikembalikan
      await this._cacheService.set(
        `playlists:${owner}`,
        JSON.stringify(result.rows.map(mapPlaylistDBToModel)),
      );
      return result.rows.map(mapPlaylistDBToModel);
    }
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }

    const { owner } = result.rows[0];
    await this._cacheService.delete(`playlists:${owner}`);
  }

  async addSongToPlaylist({ playlistId, songId }) {
    const id = `playlist-song-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlist_songs VALUES($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Gagal menambahkan lagu kedalam playlist ini');
    }

    await this._cacheService.delete(`songsFromPlaylist:${playlistId}`);
    return result.rows[0].id;
  }

  async getPlaylistById(id) {
    try {
      const result = await this._cacheService.get(`Playlist:${id}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: `SELECT playlists.id, playlists.name, users.username FROM playlist_songs
        INNER JOIN playlists ON playlists.id = playlist_songs.playlist_id
        LEFT JOIN users ON users.id = playlists.owner
        WHERE playlist_songs.playlist_id = $1`,
        values: [id],
      };
      const result = await this._pool.query(query);

      if (!result.rowCount) {
        throw new NotFoundError('Playlist tidak ditemukan');
      }

      await this._cacheService.set(`Playlist:${id}`, JSON.stringify(result.rows[0]));

      return result.rows[0];
    }
  }

  async getSongsFromPlaylist(songId) {
    try {
      const result = await this._cacheService.get(`songsFromPlaylist:${songId}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: `SELECT songs.* FROM playlist_songs
          INNER JOIN songs ON songs.id = playlist_songs.song_id
          WHERE playlist_songs.playlist_id = $1`,
        values: [songId],
      };
      const result = await this._pool.query(query);

      if (!result.rowCount) {
        throw new NotFoundError('Playlist tidak ditemukan');
      }

      const acquiredSongs = result.rows;
      const songs = acquiredSongs.map((song) => ({
        id: song.id,
        title: song.title,
        performer: song.performer,
      }));

      await this._cacheService.set(`songsFromPlaylist:${songId}`, JSON.stringify(songs));
      return songs;
    }
  }

  async deleteSongFromPlaylist(playlistId, songId) {
    const query = {
      text: 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING id',
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Lagu didalam playlist gagal dihapus. Id tidak ditemukan');
    }

    await this._cacheService.delete(`songsFromPlaylist:${playlistId}`);
  }

  async verifyPlaylistOwner(id, owner) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    const playlist = result.rows[0];

    if (playlist.owner !== owner) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      try {
        await this._collaborationService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }

  async verifySongIsExist(songId) {
    const query = {
      text: 'SELECT * FROM songs WHERE id = $1',
      values: [songId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Lagu tidak ditemukan');
    }
  }
}

module.exports = PlaylistsService;
