const path = require('path');
require('dotenv').config();
const Hapi = require('@hapi/hapi', );
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const ClientError = require('./exceptions/ClientError');

// albums - submission 1
const albums = require('./api/albums');
const AlbumsService = require('./services/postgres/AlbumsService');
const AlbumsValidator = require('./validator/albums');

// songs - submission 1
const songs = require('./api/songs');
const SongsService = require('./services/postgres/SongsService');
const SongsValidator = require('./validator/songs');

// users - submission 2
const users = require('./api/users');
const UsersService = require('./services/postgres/UsersService');
const UsersValidator = require('./validator/users');

// authentications - submission 2
const authentications = require('./api/authentications');
const AuthenticationsService = require('./services/postgres/AuthenticationsService');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validator/authentications');

// Playlist - submission 2
const playlists = require('./api/playlists');
const PlaylistsService = require('./services/postgres/PlaylistsService');
const PlaylistsValidator = require('./validator/playlists');

// Collaborations - submission 2
const Collaborations = require('./api/collaborations');
const CollaborationsService = require('./services/postgres/CollaborationsService');
const CollaborationsValidator = require('./validator/collaborations');

// Exports - submission 3
const _exports = require('./api/exports');
const ProducerService = require('./services/rabbitmq/ProducerService');
const ExportsValidator = require('./validator/exports');

// Storage - submission 3
const StorageService = require('./services/storage/StorageService');

// Cache - submission 3
const CacheService = require('./services/redis/CacheService');

const init = async () => {
  const cacheService = new CacheService();
  const collaborationsService = new CollaborationsService();
  const albumsService = new AlbumsService(cacheService);
  const playlistsService = new PlaylistsService(collaborationsService);
  const authenticationsService = new AuthenticationsService();
  const usersService = new UsersService();
  const storageService = new StorageService(path.resolve(__dirname, 'api/albums/file/covers'));

  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  }, );

  // Error handling
  server.ext('onPreResponse', (request, h) => {
    const {
      response
    } = request;
    if (response instanceof ClientError) {
      const newResponse = h.response({
        status: 'fail',
        message: response.message,
      });
      newResponse.code(response.statusCode);
      return newResponse;
    }
    if (response instanceof Error) {
      const {
        statusCode,
        payload
      } = response.output;
      if (statusCode === 401) {
        return h.response(payload).code(401);
      }
      const newResponse = h.response({
        status: 'error',
        message: 'Maaf, terjadi kegagalan pada server kami.',
      });
      console.log(response);
      newResponse.code(500);
      return newResponse;
    }
    return response.continue || response;
  });

  await server.register([{
      plugin: Jwt,
    },
    {
      plugin: Inert,
    },
  ]);

  server.auth.strategy('music_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  await server.register([{
      plugin: songs,
      options: {
        service: new SongsService(),
        validator: SongsValidator,
        storageService: storageService,
      },
    },
    {
      plugin: albums,
      options: {
        service: albumsService,
        validator: AlbumsValidator
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: playlists,
      options: {
        service: playlistsService,
        validator: PlaylistsValidator,
      },
    },
    {
      plugin: Collaborations,
      options: {
        collaborationsService,
        playlistsService,
        validator: CollaborationsValidator
      }
    },
    {
      plugin: _exports,
      options: {
        service: ProducerService,
        validator: ExportsValidator,
        playlistsService,
      },
    },
  ], );

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
