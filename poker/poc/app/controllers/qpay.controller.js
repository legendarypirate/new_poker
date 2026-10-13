const db = require("../models");
const Age = db.ages;
const Op = db.Sequelize.Op;
const axios = require('axios');

// Set up multer for file uploads
const multer = require('multer');
const path = require('path');

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'app/assets'); // Specify the destination folder
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Initialize multer upload
const upload = multer({ storage: storage }).single('image');

// Create and Save a new Banner
exports.create = async (req, res) => {
    try {
      // Step 1: Get Bearer token
      const authResponse = await axios.post('https://merchant.qpay.mn/v2/auth/token', {}, {
        auth: {
          username: 'TEENS_CLUB',
          password: 'drqD1iTi'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      const accessToken = authResponse.data.access_token;
      // Step 2: Prepare invoice body
      const invoiceBody = {
        invoice_code: "TEENS_CLUB_INVOICE",
        sender_invoice_no: "123455678",
        invoice_receiver_code: "83",
        sender_branch_code: "BRANCH1",
        invoice_description: "Order No1311 200.00",
        enable_expiry: "false",
        allow_partial: false,
        minimum_amount: null,
        allow_exceed: false,
        maximum_amount: null,
        amount: 200,
        callback_url: "https://bd5492c3ee85.ngrok.io/payments?payment_id=12345678",
        sender_staff_code: "online",
        sender_terminal_code: null,
        sender_terminal_data: {
          name: null
        },
        allow_subscribe: true,
        subscription_interval: "1D",
        subscription_webhook: "http://localhost:1000",
        note: null,
       
        invoice_receiver_data: {
          register: "UZ96021105",
          name: "Ganzul",
          email: "test@gmail.com",
          phone: "88614450"
        },
        lines: [
          {
            tax_product_code: "6401",
            line_description: " Order No1311 200.00 .",
            line_quantity: "1.00",
            line_unit_price: "200.00",
            note: "-.",
            discounts: [
              {
                discount_code: "NONE",
                description: " discounts",
                amount: 10,
                note: " discounts"
              }
            ],
            surcharges: [
              {
                surcharge_code: "NONE",
                description: "Хүргэлтийн зардал",
                amount: 10,
                note: " Хүргэлт"
              }
            ],
            taxes: [
              {
                tax_code: "VAT",
                description: "НӨАТ",
                amount: 20,
                note: " НӨАТ"
              }
            ]
          }
        ]
      };
        
      // Step 3: Send invoice with Bearer token
      const invoiceResponse = await axios.post('https://merchant.qpay.mn/v2/invoice', invoiceBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      // Step 4: Respond back
      res.status(200).json({
        message: 'Invoice created successfully',
        data: invoiceResponse.data
      });
  
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      res.status(500).json({
        message: 'Failed to create invoice',
        error: error.response?.data || error.message
      });
    }
  };
// Retrieve all Banners from the database.
exports.findAll = async (req, res) => {
  const link = req.query.link;
  var condition = link ? { link: { [Op.like]: `%${link}%` } } : null;

  try {
    const data = await Age.findAll({ where: condition });
    res.json({ success: true, data: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving banners." });
  }
};

// Find a single Banner with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  Age.findByPk(id)
    .then(data => {
      if (data) {
        res.json({ success: true, data: data });
      } else {
        res.status(404).json({ success: false, message: `Cannot find Banner with id=${id}.` });
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: "Error retrieving Banner with id=" + id });
    });
};

// Update a Banner by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;
  console.log(req.body);
  const updateData = {
    age: req.body.age || null,// Convert age to JSON if present
  };

  Age.update(updateData, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        return Age.findByPk(id); // Fetch the updated entry
      } else {
        throw new Error(`Cannot update Banner with id=${id}. Maybe Banner was not found or req.body is empty!`);
      }
    })
    .then(updatedEntry => {
      res.json({
        success: true,
        message: "age was updated successfully.",
        data: updatedEntry
      });
    })
    .catch(err => {
      res.status(500).json({
        success: false,
        message: "Error updating Banner with id=" + id,
        error: err.message
      });
    });
};


// Delete a Banner with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  Age.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.json({ success: true, message: "Age was deleted successfully!" });
      } else {
        res.status(404).json({ success: false, message: `Cannot delete Banner with id=${id}. Maybe Banner was not found!` });
      }
    })
    .catch(err => {
      res.status(500).json({ success: false, message: "Could not delete Banner with id=" + id });
    });
};

// Delete all Banners from the database.
exports.deleteAll = (req, res) => {
  Banner.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.json({ success: true, message: `${nums} Banners were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).json({ success: false, message: err.message || "Some error occurred while removing all banners." });
    });
};

// find all published Banner
exports.findAllPublished = (req, res) => {
    Age.findAll({ where: { published: true } })
    .then(data => {
      res.json({ success: true, data: data });
    })
    .catch(err => {
      res.status(500).json({ success: false, message: err.message || "Some error occurred while retrieving banners." });
    });
};
