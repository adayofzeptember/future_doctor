const express = require('express');
const db_FutureDoctor = require('../db/db_connect');
const users_router = express.Router();
const verifyToken = require('../function/token');
const { format } = require('date-fns');
const app = express();

users_router.get('/me', verifyToken, (req, res) => {
    const userIdToken = req.tokenData.userId; // Extract userId from token

    const get_profile_query = `
    SELECT 
    users.user_email, 
    users.create_datetime,

    mod_customer.forename, 
    mod_customer.surename, 
    mod_customer.id_card,
    mod_customer.id_customer,
    
    user_address.address,
    user_address.district, 
    user_address.postcode,
    user_address.province,
    user_address.amphur,
    user_address.telephone,
    
    user_images.name,
    user_images.directory

    FROM users 
    JOIN mod_customer ON users.id_data_role = mod_customer.id_customer
    LEFT JOIN user_images ON users.id_data_role = user_images.id_user 
    LEFT JOIN user_address ON users.id_data_role = user_address.id_user 
    WHERE mod_customer.id_customer = ?`;


    db_FutureDoctor.query(get_profile_query, [userIdToken], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(401).json({ message: 'ไม่พบข้อมูล' });
        }

        const user = results[0];

        res.status(200).json({
            success: true,
            user_data: {

                id_customer: user.id_customer,
                email: user.user_email,
                create_datetime: user.create_datetime,
                forename: user.forename || "-",
                surename: user.surename || "-",


            }
        });
    });
});

users_router.put('/me', verifyToken, (req, res) => {
    const userIdToken = req.tokenData.userId; // Extract userId from token

    const get_profile_query = `
    SELECT 
    users.user_email, 
    users.create_datetime,

    mod_customer.forename, 
    mod_customer.surename, 
    mod_customer.id_card,
    mod_customer.id_customer,
    
    user_address.address,
    user_address.district, 
    user_address.postcode,
    user_address.province,
    user_address.amphur,
    user_address.telephone,
    
    user_images.name,
    user_images.directory

    FROM users 
    JOIN mod_customer ON users.id_data_role = mod_customer.id_customer
    LEFT JOIN user_images ON users.id_data_role = user_images.id_user 
    LEFT JOIN user_address ON users.id_data_role = user_address.id_user 
    WHERE mod_customer.id_customer = ?`;


    db_FutureDoctor.query(get_profile_query, [userIdToken], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(401).json({ message: 'ไม่พบข้อมูล' });
        }

        const user = results[0]; // Get fresh user info

        res.status(200).json({
            message: 'Access granted',
            data: {
                user: {
                    id_customer: user.id_customer,
                    email: user.user_email,
                    create_datetime: user.create_datetime,
                    forename: user.forename,
                    surename: user.surename,
                    pic: {
                        name: user.name || "no-pic",
                        directory: user.directory || "no-dir found",
                    },
                    id_card: user.id_card,
                    address: user.address || "", // If address is null, return empty string
                    district: user.district || "",
                    postcode: user.postcode || "",
                    province: user.province || "",
                    amphur: user.amphur || "",
                    telephone: user.telephone || ""
                }
            }
        });
    });
});

users_router.put('/update_user/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    const { firstname, lastname, telephone, address, district, amphur, province, postcode } = req.body;

    const query_check_addres = 'SELECT id_user FROM user_address WHERE id_user = ?';

    db_FutureDoctor.query(query_check_addres, [userId], (err, resultCheck) => {
        if (err) {
            console.error('UPDATE ERROR --->', err.message);
            return res.status(500).json({ message: 'Internal Server Error get iduser' });
        }

        if (resultCheck.length > 0) {
            const query_update_address = `
                UPDATE user_address  
                SET                                                                                                         
                    address = ?, 
                    district = ?, 
                    amphur = ?, 
                    province = ?, 
                    postcode = ?, 
                    telephone = ?
                WHERE id_user = ?`;
            db_FutureDoctor.query(query_update_address, [address, district, amphur, province, postcode, telephone, userId], (err, resultUpdate) => {
                if (err) {
                    console.error('UPDATE user_address ERROR --->', err.message);
                    return res.status(500).json({ message: 'Internal Server Error during address update' });
                }
                const query_update_modcus = `UPDATE mod_customer SET forename = ?, surename = ?, telephone = ? WHERE id_customer = ?`;
                const values = [firstname, lastname, telephone, userId];
                db_FutureDoctor.query(query_update_modcus, values, (err, resultInsert_mc) => {
                    if (err) {
                        console.error('UPDATE mod_customer ERROR --->', err.message);
                        return res.status(500).json({ message: 'Internal Server Error during mod_customer update' });
                    }

                    return res.status(200).json({
                        message: 'update เรียบร้อย id:' + userId,
                        data: {
                            id_user:
                                userId,
                            firstname,
                            lastname,
                            telephone,
                            address,
                            district,
                            amphur,
                            province,
                            postcode
                        }
                    });
                });
            });
        } else {
            const query_insert_address = `INSERT INTO user_address 
                (id_user, address, district, amphur, province, postcode, telephone) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

            db_FutureDoctor.query(query_insert_address, [userId, address, district, amphur, province, postcode, telephone], (err, resultInsert) => {
                if (err) {
                    console.error('INSERT user_address ERROR --->', err.message);
                    return res.status(500).json({ message: 'Internal Server Error INSERT user_address ERROR' });
                } else {
                    const query_update_modcus = `UPDATE mod_customer SET forename = ?, surename = ?, telephone = ? WHERE id_customer = ?`;
                    const values = [firstname, lastname, telephone, userId];

                    db_FutureDoctor.query(query_update_modcus, values, (err, resultInsert_mc) => {
                        if (err) {
                            console.error('UPDATE mod_customer ERROR --->', err.message);
                            return res.status(500).json({ message: 'Internal Server Error UPDATE mod_customer ERROR' });
                        }
                        return res.status(201).json({
                            message: 'insert ข้อมูลใหม่เรียบร้อย id:' + userId,
                            data: {
                                id_user: userId,
                                firstname,
                                lastname,
                                telephone,
                                address,
                                district,
                                amphur,
                                province,
                                postcode
                            }
                        });
                    });
                }
            });
        }
    });
});

users_router.get('/profile', verifyToken, (req, res) => {
    const userIdToken = req.tokenData.userId;
console.log(userIdToken);

    const get_profile_query = `
    SELECT * FROM registrations WHERE create_id = ?`;


    db_FutureDoctor.query(get_profile_query, [userIdToken], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(401).json({ message: 'ไม่พบข้อมูลการสมัครสอบ' });
        }

        const userInfo = results[0];
        res.status(200).json({
            success: true,
            user_info: {
                idcard: userInfo.idcard,
                student_id: userInfo.student_id || "-",
                firstname: userInfo.firstname,
                lastname: userInfo.lastname,
                email: userInfo.email_register,
                phone: userInfo.phone,
                class_level: userInfo.class_level,
                subject_line: userInfo.subject_line,
                school: userInfo.school,
                address: userInfo.address
            }
        });
    });
});

users_router.put('/profile', verifyToken, (req, res) => {
    const userIdToken = req.tokenData.userId;
    const {
        nationalId,
        firstName,
        lastName,
        phone,
        gradeLevel,
        major,
        school,
        address
    } = req.body;

    const update_regis = `
    UPDATE registrations  
    SET                                                                                                         
      idcard = ?, 
      firstname = ?, 
      lastname = ?, 
      phone = ?, 
      class_level = ?, 
      subject_line = ?,
      school = ?,
      address = ?
    WHERE create_id = ?
  `;

    db_FutureDoctor.query(
        update_regis,
        [nationalId, firstName, lastName, phone, gradeLevel, major, school, address, userIdToken],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
            }

            // ✅ ใช้ affectedRows แทน length
            // if (results.affectedRows === 0) {
            //     return res.status(404).json({ message: 'ไม่พบข้อมูลที่จะแก้ไข' });
            // }

            res.status(200).json({
                status: 'success',
                message: 'อัปเดทข้อมูลเสร็จสิ้น'
            });
        }
    );
});

users_router.put('/profile/member', (req, res) => {

    const formattedDate = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const {
        create_id,
        firstName,
        lastName,
        phone,
        email,
        gradeLevel,
        major,
        school,
    } = req.body;

    const update_regis = `
    UPDATE registrations  
    SET                                                                                                         
      firstname = ?, 
      lastname = ?, 
      phone = ?, 
      email_register = ?,
      class_level = ?, 
      subject_line = ?,
      school = ?,
      update_datetime = ?
    WHERE create_id = ?
  `;

    db_FutureDoctor.query(
        update_regis,
        [firstName, lastName, phone, email, gradeLevel, major, school, formattedDate, create_id],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
            }

            res.status(200).json({
                status: 'success',
                message: 'อัปเดทข้อมูลเสร็จสิ้น'
            });
        }
    );
});

users_router.get('/log_login', verifyToken, (req, res) => {
    const userIdToken = req.tokenData.userId;
    const { start_date, end_date, limit } = req.query;


    const rowLimit = parseInt(limit, 10) || 25;

    let query = `
        SELECT ip_address, browser, create_datetime 
        FROM user_log_login 
        WHERE id_user_login = ? 
    `;
    const params = [userIdToken];

    if (start_date && end_date) {
        query += ` AND create_datetime BETWEEN ? AND ? `;
        params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    }

    query += ` ORDER BY create_datetime DESC LIMIT ?`;
    params.push(rowLimit);

    db_FutureDoctor.query(query, params, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }
        if (results.length === 0) {
            return res.status(200).json({ message: 'ไม่พบข้อมูล' });
        }

        
        return res.status(200).json({
            success: true,
            results
        });
    });
});



module.exports = users_router;


