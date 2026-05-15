const express = require('express');
const db_FutureDoctor = require('../db/db_connect');
const payment_router = express.Router();
const verifyToken = require('../function/token');

payment_router.get('/gbpay/check-status', verifyToken, (req, res) => {
    const { referenceNo, type, id_customer } = req.query;

    const selectCheck = 'SELECT ref_no FROM data_gb_prime_pay WHERE id_customer = ?';
    db_FutureDoctor.query(selectCheck, [id_customer], (err, resultsCheck1) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        }

        if (resultsCheck1.length === 0) {
            return res.status(200).json({
                status_code: '0',
                message: 'ยังไม่มีข้อมูล',
            });
        }

        const check_gb_pay =
            'SELECT * FROM data_gb_prime_pay WHERE id_customer = ? AND ref_no = ?';
        db_FutureDoctor.query(check_gb_pay, [id_customer, referenceNo], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
            }

            if (results.length === 0) {
                return res.status(200).json({
                    status_code: '00',
                    id_customer: id_customer,
                    message: 'ยังไม่จ่าย',
                });
            } else if (results[0].status === '00' || results.length > 0) {
                const gb = results[0].status_gb;
                const parts = gb.split('-');
                const lastPart = parts[parts.length - 1];

                return res.status(200).json({
                    status_code: '01',
                    id_customer: id_customer,
                    message: 'จ่ายแล้ว',
                    gbpReferenceNo: lastPart,
                });
            }
        });
    });
});


module.exports = payment_router;
