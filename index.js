const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const PDFDoc = require('pdfkit');
const fs = require('fs');
const mysql = require('mysql2');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const app = express();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'web';
const DB_PORT = process.env.DB_PORT || '3306';

const connection = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  database: DB_NAME,
  port: DB_PORT,
  password: DB_PASSWORD
});

// Middleware para habilitar CORS
app.use(cors());

const folder = path.join(__dirname+'/src/archivos/');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, folder)
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

//const upload = multer( { dest:folder } );
const upload = multer( {storage: storage} );

app.use(upload.single('archivo'));

// Middlewares que parsean el cuerpo de la solicitud a JSON o texto, cuando se recibe json
app.use(express.json());
app.use(express.text());

app.use(express.urlencoded( { extended : true } ));

const validacion = [
    check('nombre').trim(),
    check('apellido').trim(),
    check('email').trim(),
    check('password').trim(),
    check('pais').trim(),
    check('estado').trim(),
    check('ciudad').trim(),
    check('direccion').trim(),
    check('email').normalizeEmail(),
    check('nombre').notEmpty().withMessage('El nombre es obligatorio'),
    check('apellido').notEmpty().withMessage('El apellido es obligatorio'),
    check('email').isEmail().withMessage('El email es inválido'),
    check('password').notEmpty().withMessage('La contraseña es obligatoria'),
    check('pais').notEmpty().withMessage('El pais es obligatorio'),
    check('estado').notEmpty().withMessage('El estado es obligatorio'),
    check('ciudad').notEmpty().withMessage('La ciudad es obligatoria'),
    check('direccion').notEmpty().withMessage('La direccion es obligatoria')
];

const validacionLogin = [
    check('email').trim(),
    check('password').trim(),
    check('email').normalizeEmail(),
    check('email').isEmail().withMessage('El email es inválido'),
    check('password').notEmpty().withMessage('La contraseña es obligatoria')
]

const validacionConsulta = [
    check('id').trim().notEmpty().withMessage('Escriba un id'),
    check('id').isNumeric().withMessage('Escriba un id valido')
];

const validacionProductos = [
    check('producto').trim(),
    check('precio').trim(),
    check('stock').trim(),
    check('imgurl').trim(),
    check('producto').notEmpty().withMessage('El nombre de producto es obligatorio'),
    check('precio').isNumeric().notEmpty().withMessage('El precio es obligatoria'),
    check('stock').isNumeric().notEmpty().withMessage('El nombre es obligatorio')
];

const validarNombreProd = [
    check('nombre').trim(),
    check('nombre').notEmpty().withMessage('El nombre es obligatorio')
]

app.get('/productos', async (req, res) => {
    try{
        connection.query("SELECT * FROM productos",
            function (err, results, fields) {

                if(err){
                    return res.status(500).json({ message: "Error al conectar con la base de datos" });
                }
                if(results.length > 0){
                    res.send(results);
                }else{
                    res.status(400).json({errors: [{
                        msg: 'No hay productos'
                    }]});
                }

            }
        )
    }catch(error){
        console.error(error);
    }
})

app.get('/productos/buscar', validarNombreProd, async (req, res) => {
    try{
        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { nombre } = req.query;
        connection.query(
            `SELECT * FROM productos WHERE nombre LIKE "%${nombre}%"`,
            function (err, results, fields) {
                if(err){
                    return res.status(500).json({ message: "Error al conectar con la base de datos" });
                }
              if(results.length > 0){
                res.json(results);
              } else{
                res.status(400).json(errors = {errors: [{
                    msg: 'No existe el producto'
                }]});
              }
              
            }
          );

    }catch(error){
        console.error(error);
    }
})

app.get('/usuario', validacionConsulta, async (req, res)=> {

    try{
        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { id } = req.query;
        connection.query(
            `SELECT * FROM usuarios WHERE id =  ${id}`,
            function (err, results, fields) {
              if(results.length > 0){
                res.json(results[0]);
              }else{
                res.status(400).json(errors = {errors: [{
                    msg: 'No existe el usuario'
                }]});
              }
              
            }
          );
    }catch(error){
        console.error(error);
    }
})

// C R E A R     U S U A R I O S
app.post('/usuarios/registro', validacion, async (req, res) => {

    try{

        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { nombre, apellido, email, password, pais, estado, ciudad, direccion } = req.body;

        connection.query('SELECT nombre From users WHERE email = "'+ email+'"',
            async function (err, results, fields){
                if(err) {
                    console.error(err);
                    
                    return res.status(500).json({errors: [{
                        msg: 'Ocurrio un error durante la consulta'
                    }]})
                }
                if(results.length > 0) {
                    return res.status(400).json(errors = {errors: [{
                        msg: 'El email ya está en uso'
                    }]});
                }else{
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(password, salt);

                    connection.query(
                        `INSERT INTO users (nombre, apellido, email, password, pais, estado, ciudad, direccion) VALUES ('${nombre}', '${apellido}', '${email}', '${hashedPassword}', '${pais}', '${estado}', '${ciudad}', '${direccion}')`,
                        function (err, results, fields) {
                            if(err){
                                res.status(500).json({errors: [{
                                    msg: 'No se pudo agregar el usuario. '+err.message
                                }]});
                                return;
                            }
                            if(results.affectedRows > 0){
                                res.status(201).json({msg: 'Usuario agregado correctamente', data : {
                                     id: results.insertId,
                                     nombre: nombre,
                                     apellido: apellido
                                     }
                                });
                            }else{
                                res.status(400).json(errors = {errors: [{
                                    msg: 'No se pudo agregar el usuario'
                                }]});
                            }

                        })
                }

            }
        )

    }catch(error){
        console.error("Error: " + error);
        
    }

})

// L O G I N
app.post('/usuarios/login', validacionLogin, async (req, res) => {
    try{

        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { email, password } = req.body;

        connection.query('SELECT id, nombre, apellido, email, password, direccion FROM users WHERE email = "'+email+'"', 
            function(err, result, fields){
                if(err) {
                    console.error("Error ",err);
                    
                    return res.status(500).json({errors: [{
                        msg: 'Ocurrio un error durante la consulta'
                    }]})
                }else{
                    if(result.length == 0){
                        return res.status(500).json({errors:[{
                            msg: 'El email no está registrado'
                        }]})
                    }else{
                        const user = result[0];

                        bcrypt.compare(password, user.password, (err, isMatch) => {
                            if (err) {
                                console.error(err);
                                return res.status(500).json({ errors: [{
                                    msg:"Error al comprobar contraseña"
                                }] });
                            }

                            if (!isMatch) {
                                return res.status(400).json({ errors: [{
                                    msg: "Usuario o contraseña incorrecta"
                                }]});
                            }

                            res.json({msg : "Se inicio sesion con exito", user : {
                                id: user.id,
                                nombre: user.nombre,
                                apellido: user.apellido,
                                email: user.email,
                                direccion: user.direccion
                            }})
                        })
                    }
                }
        })

    }catch(error){
        console.error("Error: "+error);
    }
})

// Consulta producto
app.get('/productos/consulta', validacionConsulta, async (req, res) => {
    try{

        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { id } = req.query;

        connection.query(
            `SELECT * FROM productos WHERE id = ${id}`,
            function (err, results, fields) {
                if(err){
                    console.error(err);
                    res.status(500).json({errors: [{
                        msg: 'No se pudo consultar el producto. '+err.message
                    }]});
                    return;
                }
                if(results.length > 0){
                    res.status(200).json(results[0]);
                }else{
                    res.status(400).json(errors = {errors: [{
                        msg: 'No se pudo encontrar el producto'
                    }]});
                }
            }
          );

    }catch(error){
        console.error(error);
        
    }
})

// C R E A R    P R O D U C T O
app.post('/productos/crear', validacionProductos, async (req, res) => {
    try{

        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }

        const { producto, precio, stock, imgurl } = req.body;

        connection.query(
            `INSERT INTO productos (nombre, precio, stock, urlimg) VALUES ('${producto}', ${precio}, ${stock}, '${imgurl}')`,
            function (err, results, fields) {
                if(err){
                    console.error(err);
                    res.status(500).json({errors: [{
                        msg: 'No se pudo crear el producto. '+err.message
                    }]});
                    return;
                }
                if(results.affectedRows > 0){
                    res.status(201).json({msg: 'Producto creado correctamente', data : {
                         id: results.insertId,
                         nombre: nombre,
                         precio: precio,
                         stock: stock,
                         imgurl: imgurl
                         }
                    });
                }else{
                    res.status(400).json(errors = {errors: [{
                        msg: 'No se pudo crear el producto'
                    }]});
                }
            }
        )

    }catch(error){
        console.error(error);
        
    }
})

// A C T U A L I Z A R    P R O D U C T O S
app.put('/productos', validacionProductos, validacionConsulta, async (req, res) => {

    try{

        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { producto, precio, stock, imgurl } = req.body;
        const { id } = req.query;

        connection.query(
            `UPDATE productos SET nombre='${producto}', precio=${precio}, stock=${stock}, urlimg='${imgurl}' WHERE id = ${id}`,
            function (err, results, fields) {
                if(err){
                    console.error(err);
                    res.status(500).json({errors: [{
                        msg: 'No se pudo actualizar el usuario. '+err.message
                    }]});
                    return;
                }
                if(results.affectedRows > 0){
                    res.status(200).json({msg: 'Usuario actualizado correctamente'});
                }else{
                    res.status(400).json(errors = {errors: [{
                        msg: 'No se pudo actualizar el usuario'
                    }]});
                }
            }
          );

    }catch(error){
        console.error("Error: "+error);
        
    }

});

// E L I M I N A R    P R O D U C T O
app.delete('/productos', validacionConsulta, async (req, res) => {  
    try{
        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { id } = req.query;

        connection.query(
            `DELETE FROM productos WHERE id = ${id}`,
            function (err, results, fields) {
                if(err){
                    console.error(err);
                    res.status(500).json({errors: [{
                        msg: 'No se pudo eliminar el producto. '+err.message
                    }]});
                    return;
                }
                if(results.affectedRows > 0){
                    res.status(200).json({msg: 'Producto eliminado correctamente'});
                } else{
                    res.status(400).json(errors = {errors: [{
                        msg: 'No se pudo eliminar el producto'
                    }]});
                }
            }
          );

    }catch(error){
        console.error("Error: "+error);
    }

})

// Compra de productos
app.post('/productos/comprar', validacionConsulta, async (req, res) => {
    try{

        const validResult = validationResult(req);
        if(!validResult.isEmpty()){
            return res.status(400).send(validResult);
        }
        const { id } = req.query;
        const user = JSON.parse(req.body);
        
        let stock;
        connection.query(`SELECT * FROM productos WHERE id = ${id}`,
            function(err, result, fields){
                if(err){
                    console.error(err);
                    res.status(500).json({errors: [{
                        msg: 'No se pudo encontrar el producto. '+err.message
                    }]});
                    return;
                }
                if(result.length > 0){
                    stock = result[0].stock;
                    if(stock == 0){
                        res.status(400).json({errors: [{
                            msg: 'No hay stock suficiente para realizar la compra'
                        }]});
                        return;
                    }
                    stock = stock - 1;
                    connection.query(`UPDATE productos SET stock='${stock}' WHERE id = ${id}`,
                        function (err, resultProd, fields){
                            if(err){
                                console.error(err);
                                res.status(500).json({errors: [{
                                    msg: 'No se pudo realizar la compra. '+err.message
                                }]});
                                return;
                            }
                            if(resultProd.affectedRows > 0){
                                const imgPath = path.join(__dirname+"/src/img/Tienda.png");
                                const docName = "recibo-" + Date.now()+".pdf";
                            
                                const doc = new PDFDoc({
                                    size: 'A4',
                                    margin: 40
                                });
                            
                                res.setHeader('Content-Type', 'application/pdf');
                                res.setHeader('Content-Disposition', 'inline; filename=informacion_usuario.pdf');
                            
                                doc.fontSize(20).text('Recibo de compra', { align: 'center' });
                            
                                doc.moveDown();
                                doc.fontSize(12);
                                doc.text('Se realizo la compra de: ' + result[0].nombre);
                                doc.text(`Cliente: ${user.nombre} ${user.apellido}`);
                                doc.text('Se enviará el producto a la direccion: '+user.direccion);
                                doc.text('Gracias por su compra!');
                            
                                if (imgPath) {
                                    if (fs.existsSync(imgPath)) {
                                        doc.moveDown();
                                        doc.image(imgPath, doc.page.width - 90 - 10, 10,{
                                            width: 90,
                                            height: 90
                                        });
                                    } else {
                                        doc.moveDown();
                                        doc.text('No se pudo cargar la imagen.');
                                    }
                                } else {
                                    doc.moveDown();
                                    doc.text('No se subió ninguna imagen.');
                                }
                                var docPath = path.join(__dirname+'/recibos/' + docName);
                                doc.end();

                                const writeStream = fs.createWriteStream(docPath);
                                doc.pipe(writeStream);

                                writeStream.on('finish', () => {
                                    res.sendFile(docPath, (err) => {
                                        if (err) {
                                            console.error("Error al enviar el archivo:", err);
                                        } else {
                                            console.log("Archivo enviado correctamente.");
                                        }
                                    });
                                });
                            }
                        }
                    )
                }
            }
        )

    }catch(error){
        console.error("Error: "+error);
    }
})

const PUERTO = process.env.PORT || 8088

app.listen(process.env.PORT || 8088, () => {
    console.log('Servidor Express escuchando en el puerto ', PUERTO);
});