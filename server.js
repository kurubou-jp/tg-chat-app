const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {};

// オープンチャット（常設ルーム）のプリセット定義
const openRooms = {
    'open-general': { name: '💬 ルーム１！', type: 'open' },
    'open-game': { name: '💬 ルーム２！', type: 'open' },
    'open-prog': { name: '💬 ルーム３！', type: 'open' },
    'open-craft': { name: '💬 ルーム４！', type: 'open' },
    'open-music': { name: '💬 ルーム５！', type: 'open' }
};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // オープンルームの一覧を返す
    socket.on('get-open-rooms', (callback) => {
        if (typeof callback === 'function') {
            callback(openRooms);
        }
    });

    // ルーム作成（合言葉対応）
    socket.on('create-room', (customId, callback) => {
        let roomId = customId;
        
        if (!roomId) {
            do {
                roomId = Math.floor(1000 + Math.random() * 9000).toString();
            } while (rooms[roomId] || openRooms[roomId]);
        }

        if (rooms[roomId] || openRooms[roomId]) {
            if (typeof callback === 'function') {
                callback({ success: false, message: "その合言葉はすでに使われています" });
            }
            return;
        }

        rooms[roomId] = { owner: socket.id, status: 'active', type: 'private' };
        socket.join(roomId);

        if (typeof callback === 'function') {
            callback({ success: true, roomId: roomId, type: 'private' });
        }
    });

    // ルーム参加
    socket.on('join-room', (data, callback) => {
        const { roomId, nickname } = data;
        
        // オープンルームの場合
        if (openRooms[roomId]) {
            socket.join(roomId);
            io.to(roomId).emit('sys-message', `${nickname} が入室しました`);
            if (typeof callback === 'function') {
                callback({ success: true, type: 'open', roomName: openRooms[roomId].name });
            }
            return;
        }

        // 通常のプライベート・カスタムルームの場合
        if (rooms[roomId] && rooms[roomId].status === 'active') {
            socket.join(roomId);
            io.to(roomId).emit('sys-message', `${nickname} が入室しました`);
            
            if (typeof callback === 'function') {
                callback({ success: true, type: 'private' });
            }
        } else {
            if (typeof callback === 'function') {
                callback({ success: false, message: "ルームが見つかりません" });
            }
        }
    });

    // メッセージの送受信
    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('receive-message', data);
    });

    // ルーム終了（ホストが退出した時など）
    socket.on('terminate-room', (roomId) => {
        // オープンルームは終了させない
        if (openRooms[roomId]) return;

        if (rooms[roomId] && rooms[roomId].owner === socket.id) {
            rooms[roomId].status = 'terminated';
            io.to(roomId).emit('room-terminated');
            delete rooms[roomId];
        }
    });

    socket.on('disconnect', () => {
        // 必要に応じた切断処理
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
