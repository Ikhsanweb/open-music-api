const path = require('path');

const routes = (handler) => [
  {
    method: 'POST',
    path: '/albums',
    handler: (request, h) => handler.postAlbumHandler(request, h),
  },
  {
    method: 'GET',
    path: '/albums/{id}',
    handler: (request) => handler.getAlbumByIdHandler(request),
  },
  {
    method: 'PUT',
    path: '/albums/{id}',
    handler: (request) => handler.putAlbumByIdHandler(request),
  },
  {
    method: 'DELETE',
    path: '/albums/{id}',
    handler: (request) => handler.deleteAlbumByIdHandler(request),
  },
  {
    method: 'POST',
    path: '/albums/{id}/covers',
    handler: (request, h) => handler.postUploadAlbumCover(request, h),
    options: {
      payload: {
        allow: 'multipart/form-data',
        multipart: true,
        output: 'stream',
        maxBytes: 512000, // 512KB
      },
    },
  },
  {
    method: 'GET',
    path: '/albums/{param*}',
    handler: {
      directory: {
        path: path.resolve(__dirname, 'cover'),
      },
    },
  },
  {
    method: 'POST',
    path: '/albums/{id}/likes',
    handler: (request, h) => handler.postLikesAlbumHandler(request, h),
    options: {
      auth: 'openmusicapp_jwt',
    },
  },
  {
    method: 'GET',
    path: '/albums/{id}/likes',
    handler: (request, h) => handler.getLikesAlbumHandler(request, h),
  },
];

module.exports = routes;
