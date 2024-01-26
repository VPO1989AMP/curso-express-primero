const ex = require("express")
const fs = require("fs")
const fileUpload = require("express-fileupload")
const morgan = require("morgan")
const app = ex()
const {Pool} =require('pg')
const { Web3 } = require('web3')

const {Client} = require('minio')

const minioClient=new Client({
    endPoint:"localhost",
    port:9009,
    accessKey:"minioadmin",
    secretKey:"minioadmin",
    useSSL:false,
})

const WEB3_PROVIDER="https://goerli.infura.io/v3/cd69ba0af5044acbb37d50bee8be7bb5"

//const web3 = new Web3(WEB3_PROVIDER)
const web3 = new Web3(new Web3.providers.HttpProvider(WEB3_PROVIDER));

const pool = new Pool({
    localhost:"localhost",
    port:5454,
    user:"postgres",
    password:"123456",
})

//para crear fichero donde añadir el log
const logOutputErrores = fs.createWriteStream("uploads/logsErrores.txt", {
    flags:"a"
})

const logOutputBuenos = fs.createWriteStream("uploads/logsBuenos.txt", {
    flags:"a"
})


app.use(ex.static("public", {
    index:"index.html"
}))
app.use(morgan('combined',{
    skip:(req,res)=> res.statusCode < 400,
    stream:logOutputErrores
}))

app.use(morgan('tiny',{
    skip:(req,res)=> !(res.statusCode < 400),
    stream:logOutputBuenos
}))

app.use(fileUpload({
    limits:{fileSize:50 * 1024 * 1024},
}));
app.use("/docs",ex.static("docs", {
}))

//coin eso montamos el middelware
app.use(ex.json())

//lo comento porque me salia como deprecated
//app.use(ex.urlencoded())

//en las versiones actuales ya no hace falta
//app.use(ex.urlencoded({extended:false}))

//las de tipo get es para ejecutar a traves
//de una url en un navegador

app.get("/welcome", (req,res) =>{
    res.send("hola1")
})

app.get("/", (req,res) =>{
    res.send("hola")
})


app.post("/echoPost", (request,response)=>{
    response.send({body:request.body, qs:request.query})
})

app.post("/echoPostExtended", (request,response)=>{
    response.send({body:request.body})
})

app.post("/echoPostJson", (request,response)=>{
    response.send({body:request.body})
})

app.post("/addUser", (req,res) =>{
    //aquí hacemos lo necesario para añadir
    // el usuario a la base de datos
    res.send("he añadido un usuario")
})

app.post("/echoParamPost/:cliente/facturas/:factura", (req,res) =>{
    res.send({
        body:req.body,
        query:req.query,
        params:req.params 
    })
})

app.get("/echoParamGet/:cliente/facturas/:factura", (req,res) =>{
    res.send({
        body:req.body,
        query:req.query,
        params:req.params 
    })
})


app.post("/uploadFicheros",async (req,res) =>{
    const f1 = req.files.file1
    await f1.mv(`uploads/${f1.name}`)
        res.send({body:req.body, fichero:{
        nombre:req.files.file1.name
    }})
})

app.post("/uploadFicherosMultiple",async (req,res) =>{
    for (const[index, file] of req.files.ficheros.entries()){
        await file.mv(`uploads/${file.name}`)
    }
    res.send("ficheros subidos")
})


app.get("/bdd/test",  async (req,res)=>{
    try{
        const respuesta = await pool.query("select now() fecha")
        res.send(respuesta.rows)
    
    } catch(error){
        res.status(500).send({error})
    }

})


app.get("/bdd/customers",  async (req,res)=>{
    try{
        const respuesta = await pool.query("select * from customers")
        res.send(respuesta.rows)
    
    } catch(error){
        res.status(500).send({error})
    }

})

app.get("/bdd/customers/:id",  async (req,res)=>{
    try{
        const respuesta = await pool.query("select * from customers where customer_id=$1",[req.params.id])
        res.send(respuesta.rows[0])
    
    } catch(error){
        res.status(500).send({error})
    }

})


app.get("/bdd/orders/:cliente",  async (req,res)=>{
    try{
        const respuesta = await pool.query("select * from orders where customer_id=$1",[req.params.cliente])
        res.send(respuesta.rows)
    
    } catch(error){
        res.status(500).send({error})
    }

})


app.get("/bdd/orders/:cliente/:id",  async (req,res)=>{
    try{
        const respuesta = await pool.query("select * from orders where customer_id=$1 and order_id=$2",
        [req.params.cliente, req.params.id])
        if (respuesta.rows.length==0){
            res.status(404).send({descripción:"no existe la factura del cliente"})
        } else{
        res.send(respuesta.rows[0])
        }
    } catch(error){
        res.status(500).send({error})
    }

})


app.get("/web3/balance/:address", async(req,res)=>{
    try{
    const balance = await web3.eth.getBalance(req.params.address)
    res.send(balance)
    }catch (error){
        res.status(500).send({error})
    }
})



app.post("/minio/createBucket", async (req, res) => {
    console.log("recibida solicitud post crear bucket")
    try {
        await minioClient.makeBucket(req.body.nombre, 'us-east-1')
        res.status(200).send({ resultado:"ok" })
    } catch(error){
        console.log(error)
        res.status(500).send({error})
    }

})

app.post("/minio/addFile", async (req, res) => {
    const bucket = req.body.bucket
    const file   = req.files.fichero
    console.log(bucket, file.name)
    try {
        await minioClient.putObject(bucket,file.name,file.data)
        res.status(200).send({resultado: "ok"})
    } catch (error) {
        console.error(error);
        res.status(500).send({error})
    }
})


app.get("/minio/:bucket/:fichero", async(req,res)=>{
    try {
        const dataStream = await minioClient.getObject(req.params.bucket, req.params.fichero)
        dataStream.pipe(res)    
    } catch (error) {
        res.status(500).send({error})
    }
    

})

//permite una url para dar borrado
app.delete("/minio/:bucket/:fichero" ,async(req,res) =>{
    try {
        minioClient.removeObjects(req.params.bucket,req.params.fichero)
    } catch (error) {
        res.status(500).send({error})
    }
})

app.listen(3344)