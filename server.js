const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const rooms = {};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // ルーム作成
    socket.on('create-room', (customId, callback) => {
        let roomId = customId;
        
        // 合言葉が空なら4桁の番号を生成
        if (!roomId) {
            do {
                roomId = Math.floor(1000 + Math.random() * 9000).toString();
            } while (rooms[roomId]);
        }

        // すでに使われている合言葉ならエラーを返す
        if (rooms[roomId]) {
            if (typeof callback === 'function') {
                callback({ success: false, message: "その合言葉はすでに使われています" });
            }
            return;
        }

        // ルーム情報を初期化
        rooms[roomId] = { owner: socket.id, status: 'active' };
        socket.join(roomId);

        // クライアントへ成功を通知
        if (typeof callback === 'function') {
            callback({ success: true, roomId: roomId });
        }
    });

    // ルーム参加
    socket.on('join-room', (data, callback) => {
        const { roomId, nickname } = data;
        if (rooms[roomId] && rooms[roomId].status === 'active') {
            socket.join(roomId);
            // 入室したことをルーム内の全員に通知
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
        // 全員（自分含む）にメッセージを転送
        io.to(data.roomId).emit('receive-message', data);
    });

    // ルームの終了（作成者のみ）
    socket.on('terminate-room', (roomId) => {
        if (rooms[roomId] && rooms[roomId].owner === socket.id) {
            rooms[roomId].status = 'terminated';
            io.to(roomId).emit('room-terminated');
            delete rooms[roomId];
        }
    });
});

// 公開サーバー用設定：process.env.PORTがあればそれを使い、なければ3000を使う
const PORT = process.env.PORT || 3000;

// '0.0.0.0' を指定することで外部からの接続を待ち受ける
http.listen(PORT, '0.0.0.0', () => {
    console.log(`サーバー起動完了！ ポート: ${PORT}`);
});