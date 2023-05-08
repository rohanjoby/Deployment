const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const apikey = '27169cc5e1a249c8980b9431f3ff70ad';
const sources = ['bbc-news','abc-news','cnn','al-jazeera-english',
'ars-technica','ary-news','associated-press','axios',
'bloomberg','business-insider','espn','entertainment-weekly'];
const uri = "mongodb://localhost:27017";
const dbName = 'news';

const app = express();

const apikey1 = 'c4423886d381833f33956fcc40ca47f0';

async function fetchNewsArticles(config) {
  const url=`https://gnews.io/api/v4/top-headlines?category=${config.category}&lang=${config.lang}&country=${config.country}&max=${config.max}&apikey=${apikey1}`;
  const response = await axios.get(url);
  let articles=response.data.articles;
  let documents=[];
  for (let art of articles) {
    documents.push({
      'title': art.title,
      'desc': art.description,
      'content': art.content,
      'publishedAt': new Date(art.publishedAt),
      'url': art.url,
      'image': art.image,
      'source': art.source.name
    });
  }
  return documents
}

async function getConfiguration(email){
  const client=await MongoClient.connect(uri,{useNewUrlParser: true, useUnifiedTopology: true});
  const db=client.db(dbName);
  const collection=db.collection('config');
  const config=await collection.findOne({email});
  await client.close();
  return config;
}

app.get('/api/gnews', async (req, res)=>{
  const email=req.query.email;
  console.log(email)
  if (!email) {
    res.status(400).json({ status: 'error', message: 'Email is required' });
    return;
  }

  try {
    const config = await getConfiguration(email);

    if (!config) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }

    const articles = await fetchNewsArticles(config);
    console.log(articles)
    res.json(articles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch news' });
  }
});

async function fetchAndStoreNews() {
  try{
    const client= await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const collectionName = 'articles';
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const url = `http://newsapi.org/v2/top-headlines?sources=${sources}&apiKey=${apikey}`;
        const response = await axios.get(url);
        console.log(response.data.articles)
        let articles = response.data.articles;
        let documents = [];
        for (let art of articles) {
          documents.push({
            'title': art.title,
            'desc': art.description,
            'content': art.content,
            'publishedAt': new Date(art.publishedAt),
            'url': art.url,
            'image': art.urlToImage
          });
        }
        //Insert
        await collection.insertMany(documents);
        console.log('News articles inserted successfully');
        await client.close()
        console.log('Disconnected from MongoDB');
      } catch (err) {
        console.error(err);
      }
    }
  setInterval(fetchAndStoreNews, 300000);
  app.get('/api/newsx', (req, res) => {
  MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
      const db = client.db(dbName);
      const collection = db.collection('articles');
      collection.find().toArray()
        .then((data) => {
          res.json(data);
          client.close();
        })
        .catch((err)=>console.error(err));
    })
    .catch((err)=>console.error(err));
});
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  console.log(email)
  console.log(password)
  MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
      const db = client.db('users');
      const collection = db.collection('users');
      return collection.findOne({ email, password });
    })
    .then(user => {
      if (user) {
        const token = 'someJWTtoken';
        res.json({ token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.message });
    });
});
app.post('/api/register',(req, res)=>{
    const { firstName,lastName,email,password } = req.body;
    console.log(email)
    console.log(password)
    MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true })
      .then(client => {
        const db = client.db('users');
        const collection = db.collection('users');
        const user = { firstName,lastName,email,password };
        return collection.insertOne(user);
      })
      .then(result => {
        res.status(201).json({ message: 'User created successfully' });
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: err.message });
      });
  });
  app.post('/api/saveinitialgnewsconfig', (req, res) => {
    const { category, lang, country, max, email} = req.body;
    const configObj = { category, lang, country, max, email};
  
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(client => {
        const db = client.db(dbName);
        const collection = db.collection('config');
        collection.insertOne(configObj)
          .then(() => {
            res.json({ status: 'success', message: 'Configuration saved successfully' });
            client.close();
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Failed to save configuration' });
            client.close();
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Failed to connect to MongoDB' });
      });
  });
  
  app.post('/api/editgnewsconfig', (req, res) => {
    const { category, lang, country, max, email } = req.body;
    const configObj = { category, lang, country, max, email };
  
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(client => {
        const db = client.db(dbName);
        const collection = db.collection('config');
        collection.updateOne({ email }, { $set: configObj })
          .then((result) => {
            if (result.matchedCount === 0) {
              res.status(404).json({ status: 'error', message: 'User not found' });
            } else {
              res.json({ status: 'success', message: 'Configuration updated successfully' });
            }
            client.close();
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Failed to update configuration' });
            client.close();
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Failed to connect to MongoDB' });
      });
  });
  const uri1 = "mongodb+srv://puthethu:NqzjnxD7Zb8GIp63@cluster0.p27ikdg.mongodb.net/?retryWrites=true&w=majority";
  const dbName1 = 'news';
  const collectionName = 'articles';
  
  async function findArticlesByKeyword(keyword) {
    const client = await MongoClient.connect(uri1, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName1);
    const collection = db.collection(collectionName);
  
    const regex = new RegExp(keyword, 'i');
    const articles = await collection.find({
      $or: [
        { title: regex },
        { desc: regex },
        { content: regex }
      ]
    }).toArray();
  
    await client.close();
    return articles;
  }
  app.post('/api/saveinitialgnewsconfig', (req, res) => {
    const { category, lang, country, max, email} = req.body;
    const configObj = { category, lang, country, max, email};
  
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(client => {
        const db = client.db(dbName);
        const collection = db.collection('config');
        collection.insertOne(configObj)
          .then(() => {
            res.json({ status: 'success', message: 'Configuration saved successfully' });
            client.close();
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Failed to save configuration' });
            client.close();
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Failed to connect to MongoDB' });
      });
  });
  
  app.post('/api/editgnewsconfig', (req, res) => {
    const { category, lang, country, max, email } = req.body;
    const configObj = { category, lang, country, max, email };
  
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(client => {
        const db = client.db(dbName);
        const collection = db.collection('config');
        collection.updateOne({ email }, { $set: configObj })
          .then((result) => {
            if (result.matchedCount === 0) {
              res.status(404).json({ status: 'error', message: 'User not found' });
            } else {
              res.json({ status: 'success', message: 'Configuration updated successfully' });
            }
            client.close();
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Failed to update configuration' });
            client.close();
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Failed to connect to MongoDB' });
      });
  });
  
  app.get('/api/getgnewsconfig', async (req, res) => {
    const { email } = req.query;
    if (!email) {
      res.status(400).json({ status: 'error', message: 'Email is required' });
      return;
    }
   console.log(email)
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(client => {
        const db = client.db(dbName);
        const collection = db.collection('config');
        collection.findOne({ email })
          .then((config) => {
            if (!config) 
            {
              res.status(404).json({ status: 'error', message: 'User not found' });
            } 
            else 
            {
              res.status(200).json(config);
            }
            client.close();
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ status: 'error', message: 'Failed to fetch configuration' });
            client.close();
          });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Failed to connect to MongoDB' });
      });
  });
  app.get('/api/getsearcharticles', async (req, res) => {
    const keyword = req.query.keyword;
    console.log(keyword)
    if (!keyword) {
      return res.status(400).json({ message: 'Keyword is required' });
    }
  
    try {
      const articles = await findArticlesByKeyword(keyword);
      console.log(articles)
      res.status(200).json(articles);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching articles' });
    }
  });
  app.listen(3000, () => {
    console.log('Server started on port 3020');
    fetchAndStoreNews();
  });
