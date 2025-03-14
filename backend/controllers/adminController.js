const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');  
const Team = require('../models/team');
const Auction = require('../models/auction')
//Not in use
const registerAdmin = async (req, res) => {
    try {
      const { username, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const newAdmin = new Admin({ username, password: hashedPassword });
      await newAdmin.save();
  
      res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Registration failed' });
    }
  };

const loginAdmin = async (req, res) => {
    try {
      console.log("In admin login");
      const { username, password } = req.body;
      const admin = await Admin.findOne({ username });
  
      if (!admin) {
        
      console.log("admin error");
        return res.status(404).json({ error: 'Admin not found' });
      }
  
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        
      console.log("password error");
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      const token = jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
      
      console.log("In admin login - token");
      res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  };

  const TeamCount = async (req, res) => {
    try {
      // Step 1: Count the total number of teams
      const totalTeams = await Team.countDocuments();
  
      // Step 2: Update the teamCount field in the Admin collection
      const admin = await Admin.findOneAndUpdate(
        { username: req.user.username },  // Assuming req.user is set by the auth middleware
        { teamCount: totalTeams },
        { new: true }
      );
  
      if (!admin) {
        return res.status(404).json({ error: 'Admin not found' });
      }
  
      res.status(200).json({ message: 'Team count updated successfully', teamCount: admin.teamCount });
    } catch (error) {
      console.error('Error updating team count:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };


  const ChangeEventStatus = async (req, res) => {
    const { newStatus } = req.body;
  
    if (!['debugging', 'auction', 'closed'].includes(newStatus)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }
  
    try {
      const admin = await Admin.findOne({ username: 'Akash' });
      if (!admin) return res.status(404).json({ message: 'Admin record not found.' });
  
      admin.eventStatus = newStatus;
      await admin.save();
  
      return res.status(200).json({ message: `Event status changed to ${newStatus}.` });
    } catch (error) {
      console.error('Error updating event status:', error);
      res.status(500).json({ message: 'Server error.' });
    }
  };

const sellPOC = async(req,res) =>{
    try{ 
      console.log(req.user.username);
      const admin = await Admin.findOne({username : req.user.username});
      const round = admin.currentAuctionRound;
      const POC = admin.currentBiddingPOC;
      const team_id = admin.highBidHoldingTeamId;
      const amount = admin.highBidAmount;
      if (!team_id) {
        return res.status(404).json({ message: 'No team found for the current round' });
      }
  
      const team = await Team.findOne({ _id: team_id });
      if (!team) {
        return res.status(404).json({ message: 'Team not found' });
      }
      const teamName = team.team_name;
      console.log(round,POC,team_id,teamName);
      if (!round || !POC || !team_id || !teamName || !amount) {
        return res.status(400).json({ message: 'Invalid data. Please check the input values.' });
      }
      const newAuction = new Auction({round,POC,bought_by: team_id,gitcoins:amount, team_name: teamName});
      team.gitcoins -= amount;
      team.POC.push(POC);
      if(team.POC.length === round){
        team.canBuyPOC=false;
      }
      await team.save();
      await newAuction.save();

      return res.status(200).json({message : `POC : '${POC}' sold  successfully`});
    }catch(error){
      console.error('Error in confirming the bid :',error);
      res.status(500).json({message:'Server error. '});
    }
}

const updateCurrentAuctionPOC = async (req, res) => {
  try {
      const { round, POC_name,max_amount } = req.body;
      console.log(round);
      console.log(POC_name);
      console.log(max_amount);
      const admin = await Admin.findOneAndUpdate(
          { username: req.user.username },
          { currentBiddingPOC: POC_name,
            currentAuctionRound: round,
            maximumBiddingAmount : max_amount,
          [`highBidAmount`]: 0,
          [`highBidHoldingTeamId`]: null
           },
          { new: true }
      );
      
      if (!admin) {
          return res.status(404).json({ message: 'Admin not found' });
      }
      
      return res.status(200).json({ message: 'currentBiddingPOC updated successfully', admin });
  } catch (error) {
      console.error('Error updating currentBiddingPOC:', error);
      return res.status(500).json({ message: 'Server error' });
  }
};

const toggleRegistration = async(req,res)=>{

  try{
    const admin = await Admin.findOne({ username: req.user.username });

if (admin) {
  admin.isRegistrationOpen = !admin.isRegistrationOpen;
  await admin.save();
}
    res.status(201).json({
      message: `Registration Status toggled Successfully! Current Registration Status = ${
        admin.isRegistrationOpen ? 'Opened' : 'Closed'
      }`
    });
  }catch(error){
    console.error('Error toggling registration status:', error);
    res.status(500).json({ message: 'Server error' });
  }

}

const bidHistory = async (req, res) => {
  try {
    const auctions = await Auction.find().sort({ createdAt: -1 }); // Sort by createdAt in descending order
    res.status(200).json(auctions);
  } catch (error) {
    console.error('Error fetching bid history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const teamStats = async(req,res)=>{
  try{
    const teams = await Team.find().sort({gitcoins : -1});
    res.status(200).json(teams);
  }catch(error){
    console.error('Error fetching Team Stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

/**
 * Fetch all teams with their POCs
 */
const getTeamsWithPOCs = async (req, res) => {
  try {
    const teams = await Team.find({}, 'team_name POC'); // Fetch only name and POCs
    console.log('Fetched teams:', teams);
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

/**
 * Delete selected POCs from selected teams
 */
const deletePOCs = async (req, res) => {
  try {
    console.log("Received request to delete POCs:", req.body);
    const teamsToDeleteFrom = req.body;

    if (!Array.isArray(teamsToDeleteFrom) || teamsToDeleteFrom.length === 0) {
      return res.status(400).json({ error: "Invalid request format" });
    }

    let uniquePOCs = new Set(); // To store unique POCs case-insensitively

    for (const { teamId, pocIndexes } of teamsToDeleteFrom) {
      const team = await Team.findById(teamId);
      if (!team) continue;

      // Collect POCs to be deleted
      pocIndexes.forEach(index => {
        if (team.POC[index]) {
          uniquePOCs.add(team.POC[index].toUpperCase()); // Ensure uniqueness
        }
      });

      // Remove POCs from team
      await Team.findByIdAndUpdate(teamId, {
        $pull: { POC: { $in: pocIndexes.map(index => team.POC[index]) } },
      });
    }

    // Fetch admin record and update `POCsToBeSold`
    const admin = await Admin.findOne();
    if (!admin) {
      return res.status(500).json({ error: "Admin record not found" });
    }

    // Convert set to array of objects: { name, isAuctioned: false }
    const newPOCs = [...uniquePOCs].map(name => ({
      name,
      isAuctioned: false,
    }));

    // Append only unique POCs that aren’t already in POCsToBeSold
    const updatedPOCs = [
      ...admin.POCsToBeSold.filter(p => !uniquePOCs.has(p.name.toUpperCase())),
      ...newPOCs,
    ];

    // Update Admin Schema
    admin.POCsToBeSold = updatedPOCs;
    await admin.save();

    res.status(200).json({ message: "POCs successfully deleted and added to auction pool." });
  } catch (error) {
    console.error("Error deleting POCs:", error);
    res.status(500).json({ error: "Failed to delete POCs" });
  }
};


const getTeamWithPoints = async (req, res) => {
  try{
    const teams = await Team.find({}, 'team_name gitcoins');
    res.status(200).json(teams);
  }catch(error){
    console.error('Error fetching Team Stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addTeamPoints = async (req, res) => {
  try{
    const teamsToAddPoints = req.body;
    if (!Array.isArray(teamsToAddPoints) || teamsToAddPoints.length === 0) {
      return res.status(400).json({ error: 'Invalid request format' });
    }
    for (const { teamId, points } of teamsToAddPoints) {
      const team = await Team.findById(teamId);
      if (!team) continue; // Skip if team not found
      team.gitcoins += points; // Add points to the team's gitcoins
      await team.save();
    }
    return res.status(200).json({ message: 'Points successfully added to teams.' });
  }catch(error){
    console.error('Error adding points to teams:', error);
    res.status(500).json({ error: 'Failed to add points to teams' });
  }
};

const getEventStatus = async (req, res) => {
  try{
    const admin = await Admin.findOne({ username: req.user.username });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const eventStatus = admin.eventStatus;
    return res.status(200).json({ eventStatus });
  }catch(error){
    console.error('Error fetching event status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getPOCsToBeSold = async (req, res) => {
  try {
    const admin = await Admin.findOne();
    if (!admin) {
      return res.status(404).json({ error: 'Admin record not found' });
    }
    
    res.json({ POCsToBeSold: admin.POCsToBeSold });
  } catch (error) {
    console.error('Error fetching POCs to be sold:', error);
    res.status(500).json({ error: 'Failed to fetch POCs to be sold' });
  }
};

const markPOCSold = async (req, res) => {
  try {
    const { POC_name } = req.body;

    const admin = await Admin.findOne();
    if (!admin) return res.status(500).json({ error: "Admin record not found" });

    console.log('aaaaaa ',POC_name);

    const pocIndex = admin.POCsToBeSold.findIndex(p => p.name === POC_name);
    if (pocIndex !== -1) {
      admin.POCsToBeSold[pocIndex].isAuctioned = true;
      await admin.save();
    }

    console.log('bbbbb  ',POC_name);

    res.json({ message: "POC marked as sold" });
  } catch (error) {
    console.error("Error marking POC as sold:", error);
    res.status(500).json({ error: "Failed to update POC status" });
  }
};

const saveDistributedPOC = async (req, res) => {
  try {
    // round passed from frontend (1 or 2, etc.)


    // Fetch the admin document that holds the distribution map
    const admin = await Admin.findOne({ username: 'Akash' });
    if (!admin) {
      console.error('Admin not found');
      return res.status(404).json({ message: 'Admin not found' });
    }
    const round = admin.currentAuctionRound;
    console.log(round)
    // Get the map that holds multiple arrays
    const distribution = admin.qn_distribution; // Map<string, string[]>

    // Fetch all teams
    const teams = await Team.find({}).sort({ team_name: 1 });

    // For each team, assemble only the POCs at the desired indices
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const pocArray = distribution.get(i.toString()); // Get the array for this team
      let newPocs = [];

      if (round === 1) {
        // Add indices [0, 1, 3] if they exist
        if (pocArray?.[0]) newPocs.push(pocArray[0]);
        if (pocArray?.[1]) newPocs.push(pocArray[1]);
        if (pocArray?.[3]) newPocs.push(pocArray[3]);
      } else if (round === 2) {
        // Add indices [2, 4] if they exist
        if (pocArray?.[2]) newPocs.push(pocArray[2]);
        if (pocArray?.[4]) newPocs.push(pocArray[4]);
      }

      // Append new POCs to existing ones without duplicates
      const updatedPocs = Array.from(new Set([...team.POC, ...newPocs]));
      team.POC = updatedPocs;
      await team.save();
      console.log(team.POC)
      console.log(`Updated POC for team: ${team.team_name}`);
    }

    // Mark the map as modified so Mongoose knows to update it
    
    console.log('Distribution assignment completed.');
    return res.status(200).json({ message: 'Distribution assignment completed.' });
  } catch (error) {
    console.error('Error assigning POCs:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deleteQnDistribution = async (req, res) => {
  try {
    const admin = await Admin.findOne({ username: req.user.username });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.qn_distribution = {}; 
    await admin.save();

    return res.status(200).json({ message: 'Qn distribution deleted successfully' });
  } catch (err) {
    console.error('Error deleting Qn distribution:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const fetchDistributionData = async(req,res)=>{
  try{
    const admin = await Admin.findOne({username : req.user.username});
    const teams = await Team.find({}).sort({ team_name: 1 });
    if(!admin){
      console.log("Admin not found");
      return res.status(404).json({message:'Admin not found'});
    }
    const teamName = [];
    for(const team of teams){
      teamName.push(team.team_name);
    }
    return res.status(200).json({message : "Qn distribution data fetched successfully",data : admin.qn_distribution,team : teamName})
  }catch(err){
    console.log('Error while fetching qn distibution data');
    return res.status(500).json({message : 'Server Error'});
  }
}

const makeCanBuyPocTrue = async (req, res) => {
  try {
    const result = await Team.updateMany({}, { $set: { canBuyPOC: true } });
    res.status(200).json({
      message: 'Updated canBuyPOC to true for all teams successfully'
    });
  } catch (err) {
    console.error('Error updating canBuyPOC:', err);
    res.status(500).json({ message: 'Failed to update canBuyPOC for teams', error: err.message });
  }
};

module.exports = {
  loginAdmin,
  registerAdmin,
  TeamCount,
  ChangeEventStatus,
  sellPOC,
  updateCurrentAuctionPOC,
  toggleRegistration,
  bidHistory,
  teamStats,
  getTeamsWithPOCs,
  deletePOCs,
  getTeamWithPoints,
  addTeamPoints,
  getEventStatus,
  saveDistributedPOC,
  deleteQnDistribution,
  getPOCsToBeSold,
  markPOCSold,
  fetchDistributionData,
  makeCanBuyPocTrue
}