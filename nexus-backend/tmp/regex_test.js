const uri = "mongodb+srv://ytbusines2_db_user:<db_password>@cluster0.yaeh7ur.mongodb.net/?appName=Cluster0";
const re = /mongodb\+srv:\/\/(?:[^@]+@)?([^:/?]+)(?:[:?]|$)/;
console.log('URI:', uri);
const m = uri.match(re);
console.log('match:', m);
