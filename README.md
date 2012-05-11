## Usage Example

js

    var PlayTable = require("playtable");
    var playtable = new PlayTable('auth+live+XXXXXXXXXXXXXXXXXXXXX','XXXXX_USER_ID_XXXXX','XXXXX_ROOM_ID_XXXXX');
    playtable.listen(8888);