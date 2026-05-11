
/* =======================================================
   CONTACTS
======================================================= */
app.get('/api/contacts', async(req,res)=>{
  try{
    const{category,q}=req.query;
    let sql=`SELECT * FROM contacts WHERE 1=1`;
    const p=[];
    if(category){p.push(category);sql+=` AND category=$${p.length}`;}
    if(q){p.push(`%${q}%`);sql+=` AND (name ILIKE $${p.length} OR company ILIKE $${p.length} OR phone ILIKE $${p.length} OR email ILIKE $${p.length})`;}
    sql+=` ORDER BY is_favorite DESC, category ASC, name ASC`;
    const r=await pool.query(sql,p);
    res.json(r.rows);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/contacts', async(req,res)=>{
  try{
    const{category,name,company,phone,phone2,email,whatsapp,address,notes,is_favorite}=req.body;
    if(!name)return res.status(400).json({error:'Nom obligatoire'});
    const r=await pool.query(`
      INSERT INTO contacts(category,name,company,phone,phone2,email,whatsapp,address,notes,is_favorite)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [category||'Autre',name,company||null,phone||null,phone2||null,
       email||null,whatsapp||null,address||null,notes||null,is_favorite||false]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/contacts/:id', async(req,res)=>{
  try{
    const{category,name,company,phone,phone2,email,whatsapp,address,notes,is_favorite}=req.body;
    const r=await pool.query(`
      UPDATE contacts SET category=$1,name=$2,company=$3,phone=$4,phone2=$5,
        email=$6,whatsapp=$7,address=$8,notes=$9,is_favorite=$10,updated_at=NOW()
      WHERE id=$11 RETURNING *`,
      [category||'Autre',name,company||null,phone||null,phone2||null,
       email||null,whatsapp||null,address||null,notes||null,is_favorite||false,req.params.id]);
    res.json(r.rows[0]);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/contacts/:id', async(req,res)=>{
  try{
    await pool.query(`DELETE FROM contacts WHERE id=$1`,[req.params.id]);
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message});}
});
