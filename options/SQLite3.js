const options = {
    client: 'sqlite3',
    connection: {
        filename: './db/chatlog.sqlite'
    },
    useNullAsDefault: true
}

console.log('Conectando a la base de datos...');

module.exports = {
    options
}