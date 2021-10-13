const fs = require('fs');
const express = require('express');
const Producto = require('./modules/producto.js');
const { v4: uuidv4 } = require('uuid');
const exphbs = require('express-handlebars');
const { Server } = require('socket.io');
const {options: optionsMariaDB} = require('./options/mariaDB');
const {options: optionsSQLite3} = require('./options/SQLite3');
const knexMariaDB = require("knex")(optionsMariaDB);
const knexSQLite3 = require("knex")(optionsSQLite3);

const app = express();
const PORT = process.env.PORT || 8080;
const routerApi = express.Router()

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(`${__dirname}/public`));
app.use('/api', routerApi);

const server = app.listen(PORT, () => {
    console.log(`Servidor http escuchando en el puerto ${server.address().port}`);
});

server.on("error", error => console.log(`Error en servidor ${error}`));

app.engine(
    "hbs",
    exphbs({
        extname: ".hbs",
        defaultLayout: "index",
        layoutsDir: `${__dirname}/views/layouts`,
        partialsDir: `${__dirname}/views/partials`
    })
);

app.set('views', './views');
app.set('view engine', 'hbs');

knexMariaDB.schema.hasTable('productos').then(exists => {
    if (!exists) {
        return knexMariaDB.schema.createTable('productos', table => {
            table.string('id').notNullable().primary(),
            table.string('title'),
            table.decimal('price', 10, 2),
            table.string('thumbnail')
        })
        .then(()=>{
            console.log('Tabla creada!');
            knexMariaDB.destroy();
        })
        .catch(e=>{
            console.log('Error en create de tabla:', e);
            knexMariaDB.destroy();
        });
    }
});

(async ()=>{
    try {
        await knexSQLite3.schema.createTable('mensajes', table => {
            table.string('email'),
            table.string('texto'),
            table.string('fecha')
        });
        console.log('Tabla de mensajes creada...');
    }
    catch(e) {
        console.log('Error en proceso:', e);
    }
})();

const mensajes = JSON.parse(fs.readFileSync('./content/mensajes.json', 'utf8'));

routerApi.get('/productos/listar', (req, res) => {
    knexMariaDB.from('productos').select('*')
    .then( (response) => {
        if (response.length) {
            res.status(200).json(response);
        } else {
            res.status(404).json({error: 'No se encontraron productos.'});
        }
    })
    .catch((e) => {
        console.log(`Error al seleccionar desde tabla: ${e}`);
        res.status(500).json({error: 'No se encontraron productos.'});
    });
});

routerApi.get('/productos/listar/:id', (req, res) => {
    let { id } = req.params;
    knexMariaDB.from('productos').select('*').where('id', id)
    .then( (response) => {
        if (response.length) {
            res.status(200).json(response);
        } else {
            res.status(404).json({error: 'No se encontró producto con ese ID.'});
        }
    })
    .catch( (e) => {
        console.log(`Error al seleccionar desde tabla: ${e}`);
        res.status(500).json({error: 'No se encontró producto con ese ID.'});
    });
});

routerApi.post('/productos/guardar/', (req, res) => {
    let { title, price, thumbnail } = req.body;
    let producto = new Producto(title,price,thumbnail,uuidv4());
    knexMariaDB.insert({id: producto.id, title: producto.title, price: producto.price, thumbnail: producto.thumbnail}).into('productos')
    .then( () => {
        if (response) {
            res.status(200).json(producto);
        } else {
            res.status(404).json({error: 'No se encontró producto con ese ID.'});
        }
    })
    .catch( (e) => {
        console.log(`Error al insertar: ${e}`);
        res.status(500).json({error: 'No se pudo agregar el producto.'});
    });
});

routerApi.put('/productos/actualizar/:id', (req, res) => {
    let { id } = req.params;
    let { title, price, thumbnail } = req.body;
    knexMariaDB.from('productos').where('id', id).update({title: title, price: price, thumbnail: thumbnail})
    .then( (response) => {
        if (response) {
            res.status(200).json({id: id, title: title, price: price, thumbnail: thumbnail});
        } else {
            res.status(404).json({error: 'No se encontró producto con ese ID.'});
        }
    })
    .catch( (e) => {
        console.log(`Error al editar: ${e}`);
        res.status(500).json({error: 'No se pudo editar el producto.'});
    });
});

routerApi.delete('/productos/borrar/:id', (req, res) => {
    let { id } = req.params;
    knexMariaDB.from('productos').where('id', id).del()
    .then( (response) => {
        if (response) {
            res.status(200).json(`Objeto id: ${id} eliminado correctamente`);
        } else {
            res.status(404).json({error: 'No se encontró producto con ese ID.'});
        }
    })
    .catch( (e) => {
        console.log(`Error al eliminar: ${e}`);
        res.status(500).json({error: 'No se pudo eliminar el producto.'});
    });
});

app.get('/', (req, res) => {
    res.render('formulario');
});

app.get('/productos/vista', (req, res) => {
    knexMariaDB.from('productos').select('*')
    .then( (response) => {
        res.render('productos', { listaProductos: JSON.parse(JSON.stringify(response, null, 4)) });
    })
    .catch((e) => {
        console.log(`Error al seleccionar desde tabla: ${e}`);
    });
});

const io = new Server(server);

io.on("connection", (socket) => {
    console.log('Escuchando socket')

    knexMariaDB.from('productos').select('*')
    .then( (response) => {
        socket.emit('listaProductos', JSON.parse(JSON.stringify(response, null, 4)));
    })
    .catch((e) => {
        console.log(`Error al seleccionar desde tabla: ${e}`);
    });

    socket.on('nuevoProducto', (data) => {
        let { title, price, thumbnail } = data;
        let producto = new Producto(title,price,thumbnail,uuidv4());
        knexMariaDB.insert({id: producto.id, title: producto.title, price: producto.price, thumbnail: producto.thumbnail}).into('productos')
        .then( () => {
            knexMariaDB.from('productos').select('*')
            .then( (response) => {
                socket.emit('listaProductos', JSON.parse(JSON.stringify(response, null, 4)));
            })
            .catch((e) => {
                console.log(`Error al seleccionar desde tabla: ${e}`);
            });
        })
        .catch( (e) => {
            console.log(`Error al insertar: ${e}`);
            res.status(500).json({error: 'No se pudo agregar el producto.'});
        });
    });

    knexSQLite3.from('mensajes').select('*')
    .then( (response) => {
        socket.emit('nuevoMensaje', JSON.parse(JSON.stringify(response, null, 4)));
    })
    .catch((e) => {
        console.log(`Error al seleccionar desde tabla: ${e}`);
    });

    socket.on('nuevoMensaje', (data) => {
        let { email, texto, fecha } = data;
        knexSQLite3.insert({email: email, texto: texto, fecha: fecha}).into('mensajes')
        .then( () => {
            knexSQLite3.from('mensajes').select('*')
            .then( (response) => {
                io.sockets.emit('nuevoMensaje', JSON.parse(JSON.stringify(response, null, 4)));
            })
            .catch((e) => {
                console.log(`Error al seleccionar desde tabla: ${e}`);
            });
        })
        .catch( (e) => {
            console.log(`Error al insertar: ${e}`);
        });
    });
});




/*
OBJETO PARA PRUEBA:
{
    "title": "Juego de mesa Carcassonne",
    "price": 5840,
    "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_824823-MLA45578263264_042021-O.webp"
}
*/

