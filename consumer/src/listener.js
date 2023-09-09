class Listener {
    constructor(playlistsService, mailSender) {
        this.playlistsService = playlistsService;
        this.mailSender = mailSender;

        this.listen = this.listen.bind(this);
    }

    async listen(message) {
        try {
            const { targetEmail, playlistId } = JSON.parse(message.content.toString());

            const playlists = await this.playlistsService.getSongsFromPlaylist(playlistId);
            const result = await this.mailSender.sendEmail(targetEmail, JSON.stringify(playlists));
            // eslint-disable-next-line no-console
            console.log(result);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
        }
    }
}

module.exports = Listener;