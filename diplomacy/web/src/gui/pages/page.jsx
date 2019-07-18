// ==============================================================================
// Copyright (C) 2019 - Philip Paquette, Steven Bocco
//
//  This program is free software: you can redistribute it and/or modify it under
//  the terms of the GNU Affero General Public License as published by the Free
//  Software Foundation, either version 3 of the License, or (at your option) any
//  later version.
//
//  This program is distributed in the hope that it will be useful, but WITHOUT
//  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
//  FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more
//  details.
//
//  You should have received a copy of the GNU Affero General Public License along
//  with this program.  If not, see <https://www.gnu.org/licenses/>.
// ==============================================================================
/** Main class to use to create app GUI. **/

import React from "react";
import {ContentConnection} from "./content_connection";
import {UTILS} from "../../diplomacy/utils/utils";
import {Diplog} from "../../diplomacy/utils/diplog";
import {FancyBox} from "../components/fancybox";
import {DipStorage} from "../utils/dipStorage";
import {PageContext} from "../components/page_context";
import {ContentGames} from "./content_games";
import {loadGameFromDisk} from "../utils/load_game_from_disk";
import {ContentGame} from "./content_game";

export class Page extends React.Component {

    constructor(props) {
        super(props);
        this.connection = null;
        this.channel = null;
        this.availableMaps = null;
        this.state = {
            // fancybox,
            fancyTitle: null,
            onFancyBox: null,
            // Page messages
            error: null,
            info: null,
            success: null,
            // Page content parameters
            name: null,
            body: null,
            // Games.
            games: {}, // Games found.
            myGames: {}  // Games locally stored.
        };
        this.error = this.error.bind(this);
        this.info = this.info.bind(this);
        this.success = this.success.bind(this);
        this.logout = this.logout.bind(this);
        this.loadGameFromDisk = this.loadGameFromDisk.bind(this);
        this.unloadFancyBox = this.unloadFancyBox.bind(this);
        this._post_remove = this._post_remove.bind(this);
        this._add_to_my_games = this._add_to_my_games.bind(this);
        this._remove_from_my_games = this._remove_from_my_games.bind(this);
        this._remove_from_games = this._remove_from_games.bind(this);
        this.onReconnectionError = this.onReconnectionError.bind(this);
    }

    static wrapMessage(message) {
        return message ? `(${UTILS.date()}) ${message}` : '';
    }

    static __sort_games(games) {
        // Sort games with not-joined games first, else compare game ID.
        games.sort((a, b) => (((a.role ? 1 : 0) - (b.role ? 1 : 0)) || a.game_id.localeCompare(b.game_id)));
        return games;
    }

    static defaultPage() {
        return <ContentConnection/>;
    }

    onReconnectionError(error) {
        this.__disconnect(error);
    }

    //// Methods to load a global fancybox.

    loadFancyBox(title, callback) {
        this.setState({fancyTitle: title, onFancyBox: callback});
    }

    unloadFancyBox() {
        this.setState({fancyTitle: null, onFancyBox: null});
    }

    //// Methods to load a page.

    load(name, body, messages) {
        const newState = {};
        if (messages) {
            for (let key of ['error', 'info', 'success'])
                newState[key] = Page.wrapMessage(messages[key]);
        }
        Diplog.printMessages(newState);
        newState.name = name;
        newState.body = body;
        this.setState(newState);
    }

    loadGames(messages) {
        this.load(
            'games',
            <ContentGames myGames={this.getMyGames()} gamesFound={this.getGamesFound()}/>,
            messages
        );
    }

    loadGameFromDisk() {
        loadGameFromDisk(
            (game) => this.load(
                `game: ${game.game_id}`,
                <ContentGame data={game}/>,
                {success: `Game loaded from disk: ${game.game_id}`}
            ),
            this.error
        );
    }

    getName() {
        return this.state.name;
    }

    //// Methods to sign out channel and go back to connection page.

    __disconnect(error) {
        // Clear local data and go back to connection page.
        this.connection.close();
        this.connection = null;
        this.channel = null;
        this.availableMaps = null;
        const message = Page.wrapMessage(error ? `${error.toString()}` : `Disconnected from channel and server.`);
        Diplog.success(message);
        this.setState({
            error: error ? message : null,
            info: null,
            success: error ? null : message,
            name: null,
            body: null,
            // When disconnected, remove all games previously loaded.
            games: {},
            myGames: {}
        });
    }

    logout() {
        // Disconnect channel and go back to connection page.
        if (this.channel) {
            this.channel.logout()
                .then(() => this.__disconnect())
                .catch(error => this.error(`Error while disconnecting: ${error.toString()}.`));
        } else {
            this.__disconnect();
        }
    }

    //// Methods to be used to set page title and messages.

    error(message) {
        message = Page.wrapMessage(message);
        Diplog.error(message);
        this.setState({error: message});
    }

    info(message) {
        message = Page.wrapMessage(message);
        Diplog.info(message);
        this.setState({info: message});
    }

    success(message) {
        message = Page.wrapMessage(message);
        Diplog.success(message);
        this.setState({success: message});
    }

    warn(message) {
        this.info(message);
    }

    //// Methods to manage games.

    updateMyGames(gamesToAdd) {
        // Update state myGames with given games. This method does not update local storage.
        const myGames = Object.assign({}, this.state.myGames);
        let gamesFound = null;
        for (let gameToAdd of gamesToAdd) {
            myGames[gameToAdd.game_id] = gameToAdd;
            if (this.state.games.hasOwnProperty(gameToAdd.game_id)) {
                if (!gamesFound)
                    gamesFound = Object.assign({}, this.state.games);
                gamesFound[gameToAdd.game_id] = gameToAdd;
            }
        }
        if (!gamesFound)
            gamesFound = this.state.games;
        this.setState({myGames: myGames, games: gamesFound});
    }

    getGame(gameID) {
        if (this.state.myGames.hasOwnProperty(gameID))
            return this.state.myGames[gameID];
        return this.state.games[gameID];
    }

    getMyGames() {
        return Page.__sort_games(Object.values(this.state.myGames));
    }

    getGamesFound() {
        return Page.__sort_games(Object.values(this.state.games));
    }

    addGamesFound(gamesToAdd) {
        const gamesFound = {};
        for (let game of gamesToAdd) {
            gamesFound[game.game_id] = (
                this.state.myGames.hasOwnProperty(game.game_id) ?
                    this.state.myGames[game.game_id] : game
            );
        }
        this.setState({games: gamesFound});
    }

    leaveGame(gameID) {
        if (this.state.myGames.hasOwnProperty(gameID)) {
            const game = this.state.myGames[gameID];
            if (game.client) {
                game.client.leave()
                    .then(() => {
                        this.disconnectGame(gameID).then(() => {
                            this.loadGames({info: `Game ${gameID} left.`});
                        });
                    })
                    .catch(error => this.error(`Error when leaving game ${gameID}: ${error.toString()}`));
            }
        } else {
            this.loadGames({info: `No game to left.`});
        }
    }

    _post_remove(gameID) {
        this.disconnectGame(gameID)
            .then(() => {
                const myGames = this._remove_from_my_games(gameID);
                const games = this._remove_from_games(gameID);
                this.setState(
                    {games, myGames},
                    () => this.loadGames({info: `Game ${gameID} deleted.`}));
            });
    }

    removeGame(gameID) {
        const game = this.getGame(gameID);
        if (game) {
            if (game.client) {
                game.client.remove()
                    .then(() => this._post_remove(gameID))
                    .catch(error => this.error(`Error when deleting game ${gameID}: ${error.toString()}`));
            } else {
                this.channel.joinGame({game_id: gameID})
                    .then(networkGame => {
                        networkGame.remove()
                            .then(() => this._post_remove(gameID))
                            .catch(error => this.error(`Error when deleting game ${gameID}: ${error.toString()}`));
                    })
                    .catch(error => this.error(`Error when connecting to game to delete (${gameID}): ${error.toString()}`));
            }
        }
    }


    disconnectGame(gameID) {
        const game = this.getGame(gameID);
        if (game) {
            if (game.client)
                game.client.clearAllCallbacks();
            return this.channel.getGamesInfo({games: [gameID]})
                .then(gamesInfo => {
                    this.updateMyGames(gamesInfo);
                })
                .catch(error => this.error(`Error while leaving game ${gameID}: ${error.toString()}`));
        }
        return null;
    }

    _add_to_my_games(game) {
        const myGames = Object.assign({}, this.state.myGames);
        const gamesFound = this.state.games.hasOwnProperty(game.game_id) ? Object.assign({}, this.state.games) : this.state.games;
        myGames[game.game_id] = game;
        if (gamesFound.hasOwnProperty(game.game_id))
            gamesFound[game.game_id] = game;
        return {myGames: myGames, games: gamesFound};
    }

    _remove_from_my_games(gameID) {
        if (this.state.myGames.hasOwnProperty(gameID)) {
            const games = Object.assign({}, this.state.myGames);
            delete games[gameID];
            DipStorage.removeUserGame(this.channel.username, gameID);
            return games;
        } else {
            return this.state.myGames;
        }
    }

    _remove_from_games(gameID) {
        if (this.state.games.hasOwnProperty(gameID)) {
            const games = Object.assign({}, this.state.games);
            delete games[gameID];
            return games;
        } else {
            return this.state.games;
        }
    }

    addToMyGames(game) {
        // Update state myGames with given game **and** update local storage.
        DipStorage.addUserGame(this.channel.username, game.game_id);
        this.setState(this._add_to_my_games(game), () => this.loadGames());
    }

    removeFromMyGames(gameID) {
        const myGames = this._remove_from_my_games(gameID);
        if (myGames !== this.state.myGames)
            this.setState({myGames}, () => this.loadGames());
    }

    hasMyGame(gameID) {
        return this.state.myGames.hasOwnProperty(gameID);
    }

    //// Render method.

    render() {
        const successMessage = this.state.success || '-';
        const infoMessage = this.state.info || '-';
        const errorMessage = this.state.error || '-';
        return (
            <PageContext.Provider value={this}>
                <div className="page container-fluid" id={this.state.contentName}>
                    <div className={'top-msg row'}>
                        <div title={successMessage !== '-' ? successMessage : ''}
                             className={'col-sm-4 msg success ' + (this.state.success ? 'with-msg' : 'no-msg')}
                             onClick={() => this.success()}>
                            {successMessage}
                        </div>
                        <div title={infoMessage !== '-' ? infoMessage : ''}
                             className={'col-sm-4 msg info ' + (this.state.info ? 'with-msg' : 'no-msg')}
                             onClick={() => this.info()}>
                            {infoMessage}
                        </div>
                        <div title={errorMessage !== '-' ? errorMessage : ''}
                             className={'col-sm-4 msg error ' + (this.state.error ? 'with-msg' : 'no-msg')}
                             onClick={() => this.error()}>
                            {errorMessage}
                        </div>
                    </div>
                    {this.state.body || Page.defaultPage()}
                    {this.state.onFancyBox && (
                        <FancyBox title={this.state.fancyTitle} onClose={this.unloadFancyBox}>
                            {this.state.onFancyBox()}
                        </FancyBox>
                    )}
                </div>
            </PageContext.Provider>
        );
    }
}