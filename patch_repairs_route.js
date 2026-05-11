/* 
  PATCH server.js — Remplacer la route app.put('/api/repairs/:id', ...)
  Trouvez cette ligne dans server.js :
  
    const status=String(req.body.status||'EN_ATTENTE'),fp=Number(req.body.final_price||0);
    const cb=Number(req.body.amount_cb||0),...
    ...
    const r=await client.query(`UPDATE repairs SET status=CAST($1 AS varchar),final_price=$2,...
  
  Et remplacez le BLOC COMPLET app.put('/api/repairs/:id',...) par :
*/

app.put('/api/repairs/:id',async(req,res)=>{
  const client=await pool.connect();
  try{
    const status=String(req.body.status||'EN_ATTENTE');
    const fp    =Number(req.body.final_price||0);
    const ep    =Number(req.body.estimated_price||0);
    const cb    =Number(req.body.amount_cb||0);
    const cash  =Number(req.body.amount_cash||0);
    const credit=Number(req.body.amount_credit||0);
    const {customer_name,phone,device_type,brand,model,serial_number,issue,comment}=req.body;
    let pm='cash';
    if(cb>0&&cash>0)pm='mixed';
    else if(cb>0)pm='card';
    else if(cash>0)pm='cash';
    else if(credit>0)pm='credit';
    await client.query('BEGIN');
    const r=await client.query(`
      UPDATE repairs SET
        status          = CAST($1 AS varchar),
        final_price     = $2,
        estimated_price = CASE WHEN $3>0 THEN $3 ELSE estimated_price END,
        customer_name   = CASE WHEN $4!='' THEN $4 ELSE customer_name END,
        phone           = CASE WHEN $5!='' THEN $5 ELSE phone END,
        device_type     = CASE WHEN $6!='' THEN $6 ELSE device_type END,
        brand           = CASE WHEN $7!='' THEN $7 ELSE brand END,
        model           = CASE WHEN $8!='' THEN $8 ELSE model END,
        serial_number   = CASE WHEN $9!='' THEN $9 ELSE serial_number END,
        issue           = CASE WHEN $10!='' THEN $10 ELSE issue END,
        comment         = $11,
        payment_method  = $12,
        amount_cb       = $13,
        amount_cash     = $14,
        amount_credit   = $15,
        updated_at      = NOW(),
        delivered_at    = CASE WHEN CAST($1 AS varchar)='TERMINE' THEN NOW() ELSE delivered_at END
      WHERE id=$16 RETURNING *`,
      [status, fp, ep,
       customer_name||'', phone||'', device_type||'',
       brand||'', model||'', serial_number||'',
       issue||'', comment||'',
       pm, cb, cash, credit, req.params.id]);
    if(credit>0){
      const rep=r.rows[0];
      const ex=await client.query(`SELECT id FROM customer_credits WHERE repair_id=$1`,[req.params.id]);
      if(ex.rows.length===0){
        await client.query(`INSERT INTO customer_credits(customer_name,phone,repair_id,total_amount,amount_paid,amount_due,status) VALUES($1,$2,$3,$4,$5,$6,'EN_COURS')`,
          [rep.customer_name||'Anonyme',rep.phone||'',req.params.id,fp,(cb+cash).toFixed(2),credit.toFixed(2)]);
      } else {
        await client.query(`UPDATE customer_credits SET amount_paid=$1,amount_due=$2,status=CASE WHEN $2<=0 THEN 'SOLDE' ELSE status END,updated_at=NOW() WHERE repair_id=$3`,
          [(cb+cash).toFixed(2),credit.toFixed(2),req.params.id]);
      }
    }
    await client.query('COMMIT');
    res.json(r.rows[0]);
  }catch(e){await client.query('ROLLBACK');res.status(500).json({error:e.message});}
  finally{client.release();}
});
