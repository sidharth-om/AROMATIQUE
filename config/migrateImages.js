async function migrateImages() {
  try {
    const categories = await Category.find({ image: { $regex: /^uploads/ } });
    console.log("Found categories to migrate:", categories.length);

    for (let category of categories) {
      const oldPath = category.image;
      const extension = oldPath.split('.').pop();
      const key = `categories/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
      let fileContent;

      try {
        fileContent = fs.readFileSync(`../../public/${oldPath}`);
      } catch (fileError) {
        console.warn(`Skipping ${oldPath}: File not found`);
        continue; // Skip to next category
      }

      await s3.upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: `image/${extension}`,
        ACL: 'public-read',
      }).promise();

      category.image = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      await category.save();
      console.log(`Migrated ${oldPath} to ${category.image}`);
    }

    console.log("Migration completed.");
    mongoose.connection.close();
  } catch (error) {
    console.error("Migration Error:", error);
    mongoose.connection.close();
    process.exit(1);
  }
}