import mongoose from "mongoose";

interface Category {
    company: mongoose.Types.ObjectId
    name:string;
    description:string;
}

const CategorySchema = new mongoose.Schema<Category>({
    company:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Company',
        required:true
    },
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String
    }
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema);

export default Category
