const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // どこからでも接続できるようにする設定
        methods: ["GET", "POST"]
    }
});

const rooms = {};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // ルーム作成（合言葉対応）
    socket.on('create-room', (customId, callback) => {
        let roomId = customId;
        
        // 合言葉が空なら4桁のランダム番号を生成
        if (!roomId) {
            do {
                roomId = Math.floor(1000 + Math.random() * 9000).toString();
            } while (rooms[roomId]);
        }

        // すでに使われている合言葉ならエラー
        if (rooms[roomId]) {
            if (typeof callback === 'function') {
                callback({ success: false, message: "その合言葉はすでに使われています" });
            }
            return;
        }

        // ルーム作成
        rooms[roomId] = { owner: socket.id, status: 'active' };
        socket.join(roomId);

        if (typeof callback === 'function') {
            callback({ success: true, roomId: roomId });
        }
    });

    // ルーム参加
    socket.on('join-room', (data, callback) => {
        const { roomId, nickname } = data;
        
        if (rooms[roomId] && rooms[roomId].status === 'active') {
            socket.join(roomId);
            // 入室メッセージを全員に送る
            io.to(roomId).emit('sys-message', `${nickname} が入室しました`);
            
            if (typeof callback === 'function') {
                callback({ success: true });
            }
        } else {
            if (typeof callback === 'function') {
                callback({ success: false, message: "ルームが見つかりません" });
            }
        }
    });

    // メッセージの送受信
    socket.on('send-message', (data) => {
        // 全員にメッセージを転送
        io.to(data.roomId).emit('receive-message', data);
    });

    // ルーム終了（ホストが退出した時など）
    socket.on('terminate-room', (roomId) => {
        if (rooms[roomId] && rooms[roomId].owner === socket.id) {
            rooms[roomId].status = 'terminated';
            io.to(roomId).emit('room-terminated');
            delete rooms[roomId];
        }
    });

    // 接続が切れた時の処理（予期せぬ切断対策）
    socket.on('disconnect', () => {
        // 誰が切れたか特定してルームを掃除する処理をここに追加もできる
    });
});

// ポート設定（Renderなどの公開サーバー用）
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
