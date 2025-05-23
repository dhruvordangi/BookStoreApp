import { User } from "../model/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"
import oauth2Client from "../utils/googleConfig.js";
import cookieParser from "cookie-parser";
import axios from 'axios'
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../model/admin.model.js";
import { Book } from "../model/book.model.js";
import mongoose from "mongoose";
import {uploadMultipleFiles} from "../utils/cloudinary.js"
const salt = bcrypt.genSaltSync(10);
const secret = "jn4k5n6n5nnn6oi4n";

const signup = async (req, res) => {
  //console.log("here i am printing signup data->",req.file);
  try {
    const { fullname, email, password,location} = req.body;

    // 🔥 Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔥 Hash password
    const hashPassword = await bcrypt.hash(password, 10);

    const profileLocalPath = req.file.path;
    console.log("localProfilePath->",profileLocalPath);
    let profile;
    try{
      profile= await uploadMultipleFiles([profileLocalPath]);
      console.log("upoading the profile pic on the cloudinary",profile);
    } catch(error){
      console.log("Error while uploading profile pic",error);
         throw new Error(500, "Failed to upload profile pic");
    }

    console.log("Profile URL ->", profile?.[0]?.url);

    // 🔥 Create user
    const createUser = await User.create({
      fullname,
      email,
      password: hashPassword,
      location,
      profilePic:profile?.[0]?.url,
    });

    // 🔥 Generate JWT Token
    const token = jwt.sign(
      { _id: createUser._id, email },
      secret,
      { expiresIn: "5h" }
    );

    // ✅ Set token as HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
    });
    console.log(res.cookies);
    

    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: createUser._id,
        fullname: createUser.fullname,
        email: createUser.email,
        role:"user",
        location: createUser.location,
        profilePic: createUser.profilePic,
      },
      token, // ✅ Sending token in response as well (optional)
    });

  } catch (error) {
    console.error("Error in signup:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const header = asyncHandler(async (req, res) => {
    console.log("req cookie  ", req.cookies);
    
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
      if (err) throw err;
      return res.json(info);
    });
});

//login
const login = async (req, res) => {
    try {
      console.log("reached here");
      
        const { email, password } = req.body;
        console.log("reached here 2");

        // Check if user exists
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({message: "user not found "});
        }
        console.log("reached here 3 ", user);
        
        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        console.log("reached here 4");
        // Generate JWT token
        const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "9h" });

        // ✅ Set token as HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true, // 🔥 Prevents XSS attacks
            secure: false,
        });
        return res.status(200).json({
            message: "Login successful",
            user: {
                _id: user._id,
                fullname: user.fullname,
                email: user.email, // ✅ Keeping email for reference
                role:"user",
            },
            token, // ✅ Sending token for frontend use (optional)
        });

    } catch (error) {
        console.error("Error in logging the user:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

const AdminLogin= asyncHandler( async ( req,res) => {
  try{
    const {email, password} = req.body;

    let user= await Admin.findOne({email});
    if( !user){
      return res.status(400).json({message: "user not found "});
    }

    const token= jwt.sign({_id: user._id}, secret, {expiresIn: "7d"});

    res.cookie("token", token, {
      httpOnly:true,
      secure:false,
    });
    res.status(200).json({
      message:"Login successful",
      admin:{
        _id:user._id,
        fullname:user.fullname,
        email: user.email,
        role:"admin",
      },
      token,
    });
  } catch(error) {
    console.error(" Error in logging the user: ", error.message);
    res.status(500).json({message: "internal server error"});
  }
});

const logoutUser = asyncHandler(async (req, res) => {
    try {
      // Clear the token cookie
      return res
        .cookie("token", "", {
          httpOnly: true,
          secure: true,
        })
        .status(200)
        .json({ message: "Successfully logged out" });
    } catch (error) {
      res.status(500).json({ message: "Logout failed", error: error.message });
    }
  });

const googleLogin = async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Authorization code is required" });
      }
  
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
  
      // Fetch user info from Google
      const userRes = await axios.get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`
      );
      const { email, name } = userRes.data; // Use 'name' from Google
  
      // Check if user exists; if not, create one
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ fullname: name, email, role: "user" });
      }
  
      // Generate JWT Token
      const token = jwt.sign({ _id: user._id }, secret, { expiresIn: "456h" });
  
      // Set token as an HTTP-only cookie
      res.cookie("token", token, {
        httpOnly: true,                     // Prevents XSS
        secure: false,                   // Helps with CSRF issues
      });
  
      // (Note: console.log(req.cookies) here will likely show an empty object,
      // because cookies are sent in the request from the client, not on the response object.)
      console.log("Cookie set for google login.");
  
      return res.status(200).json({
        message: "Login successful",
        user: {
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          role:"user"
        },
        token, // Optionally sent for frontend use
      });
    } catch (error) {
      console.error("Error in Google login:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

const getUserDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('cart')
      .populate('bought_books');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      role: user.role,
      cart: user.cart,
      bought_books: user.bought_books,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addToCart = async (req, res) => {
  try {
    // console.log("req.body ", req?.body);
    
    const { userId, bookId } = req.body;

    if (!userId || !bookId) {
      return res.status(400).json({ message: "User ID and Book ID are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if book already exists in cart
    if (user.cart.includes(bookId)) {
      return res.status(400).json({ message: "Book already in cart" });
    }

    user.cart.push(bookId);
    await user.save();

    res.status(200).json({ message: "Book added to cart", cart: user.cart });
  } catch (error) {
    console.error("Error adding book to cart:", error);
    res.status(500).json({ message: "Server error while adding book to cart" });
  }
};

const getBoughtBooks = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user and populate bought_books
    const user = await User.findById(userId).populate("bought_books");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, books: user.bought_books });
  } catch (error) {
    console.error("Error fetching bought books:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const addToFavourites = async (req, res) => {
  try {
    const { userId } = req.params;
    const { bookId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.favourites.includes(bookId)) {
      return res.status(400).json({ message: "Book already in favourites" });
    }

    user.favourites.push(bookId);
    await user.save();

    return res.status(200).json({ message: "Book added to favourites" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getFavourites = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate("favourites");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ favourites: user.favourites });
  } catch (error) {
    res.status(500).json({ message: "Server error fetching favourites" });
  }
};

 const removeFromCart = async (req, res) => {
  const { userId } = req.params;
  const { bookId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ message: "Invalid user or book ID" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = user.cart.filter(id => id.toString() !== bookId);
    await user.save();

    return res.status(200).json({ message: "Book removed from cart" });
  } catch (err) {
    console.error("Error removing from cart:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const completePayment = async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId).populate("cart");

    if (!user) return res.status(404).json({ message: "User not found" });

    const bookIds = user.cart.map(book => book._id.toString());

    user.bought_books.push(...bookIds.filter(id => !user.bought_books.includes(id)));
    user.cart = [];

    await user.save();
    res.status(200).json({ message: "Payment complete. Cart updated." });

  } catch (error) {
    console.error("Error updating user after payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId)
      .populate("favourites", "name image profilePic") // here i had added the profilePic
      .populate("bought_books", "name image")
      .select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

const getFavorites = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate("favourites");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ favourites: user.favourites });
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ message: "Server error fetching favorites" });
  }
};

const removeFavorite = async (req, res) => {
  const { userId, bookId } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.favourites = user.favourites.filter(
      (favId) => favId.toString() !== bookId
    );

    await user.save();

    res.status(200).json({ message: "Book removed from favorites" });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export {login,
    logoutUser,
    header,
    signup,
    getUserDashboard,
    googleLogin,
    AdminLogin,
    addToCart,
    getBoughtBooks,
    addToFavourites,
    getFavourites,
    removeFromCart,
    completePayment,
    getUserById,
    getFavorites,
    removeFavorite
}