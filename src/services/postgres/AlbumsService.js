/* eslint-disable no-underscore-dangle */

const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const { mapAlbumDBToModel, mapSongDBToModel } = require('../../utils');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');

class AlbumsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;
  }

  async addAlbum({ name, year }) {
    const id = `album-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3) RETURNING id',
      values: [id, name, year],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan');
    }

    return result.rows[0].id;
  }

  async getAlbumWithSongs(id) {
    try {
      // mendapatkan album dari cache
      const result = await this._cacheService.get(`albumSongs:${id}`);
      return JSON.parse(result);
    } catch (error) {
      // bila gagal, diteruskan dengan mendapatkan album dari database
      const query = {
        text: 'SELECT id, title, performer FROM songs WHERE album_id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);
      // album akan disimpan pada cache sebelum fungsi get dikembalikan
      await this._cacheService.set(
        `albumSongs:${id}`,
        JSON.stringify(result.rows.map(mapSongDBToModel)),
      );
      return result.rows.map(mapSongDBToModel);
    }
  }

  async getAlbumById(id) {
    try {
      const result = await this._cacheService.get(`album:${id}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: 'SELECT * FROM albums WHERE id = $1',
        values: [id],
      };
      const result = await this._pool.query(query);

      if (!result.rowCount) {
        throw new NotFoundError('Album tidak ditemukan');
      }
      await this._cacheService.set(
        `album:${id}`,
        JSON.stringify(result.rows.map(mapAlbumDBToModel)[0]),
      );
      return result.rows.map(mapAlbumDBToModel)[0];
    }
  }

  async editAlbumById(id, { name, year }) {
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2 WHERE id = $3 RETURNING id',
      values: [name, year, id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }
    await this._cacheService.delete(`album:${id}`);
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }

    await this._cacheService.delete(`album:${id}`);
  }

  async addAlbumCoverById(id, cover) {
    const query = {
      text: 'UPDATE albums SET "coverUrl" = $1 WHERE id = $2 RETURNING id',
      values: [cover, id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Cover album gagal ditambahkan, Id tidak ditemukan');
    }

    await this._cacheService.delete(`album:${id}`);
  }

  async addAlbumLikes(albumId, userId) {
    const likesQuery = {
      text: 'SELECT * FROM album_likes WHERE album_id = $1 AND user_id = $2',
      values: [albumId, userId],
    };

    const likesResult = await this._pool.query(likesQuery);

    if (!likesResult.rowCount) {
      const id = `likes-${nanoid(16)}`;
      const insertLikesQuery = {
        text: 'INSERT INTO album_likes VALUES($1, $2, $3)',
        values: [id, albumId, userId],
      };

      const insertLikesResult = await this._pool.query(insertLikesQuery);

      if (!insertLikesResult.rowCount) {
        throw new InvariantError('Like gagal ditambahkan');
      }
    } else {
      const deleteLikesQuery = {
        text: 'DELETE FROM album_likes WHERE album_id = $1 AND user_id = $2',
        values: [albumId, userId],
      };

      const deleteLikesResult = await this._pool.query(deleteLikesQuery);

      if (!deleteLikesResult.rowCount) {
        throw new InvariantError('Like gagal dihapus');
      }
    }

    await this._cacheService.delete(`likes:${albumId}`);
  }

  async getAlbumLikes(albumId) {
    try {
      const result = await this._cacheService.get(`likes:${albumId}`);
      return { likes: JSON.parse(result), cache: 1 };
    } catch (error) {
      const getQuery = {
        text: 'SELECT * FROM album_likes WHERE album_id = $1',
        values: [albumId],
      };

      const result = await this._pool.query(getQuery);

      await this._cacheService.set(`likes:${albumId}`, JSON.stringify(result.rows.length));
      return { likes: result.rowCount };
    }
  }
}

module.exports = AlbumsService;
