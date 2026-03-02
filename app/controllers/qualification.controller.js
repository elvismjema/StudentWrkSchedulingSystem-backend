import db from "../models/index.js";
import { Op } from "sequelize";

const User = db.user;
const Qualification = db.qualification;
const UserQualification = db.userQualification;
const Position = db.position;
const PositionQualification = db.positionQualification;
const Shift = db.shift;

// Get all students with their qualifications (optional filter by qualificationId)
export const getStudentsWithQualifications = async (req, res) => {
  try {
    const { qualificationId } = req.query;
    
    let whereClause = { role: 'student' };
    let includeClause = [
      {
        model: Qualification,
        as: 'qualifications',
        through: {
          model: UserQualification,
          attributes: ['approval_status', 'approved_at', 'document_name']
        },
        required: false
      }
    ];

    // If qualificationId is provided, filter students who have this qualification
    if (qualificationId) {
      includeClause[0].through = {
        ...includeClause[0].through,
        where: { qualification_id: qualificationId }
      };
      includeClause[0].required = true;
    }

    const students = await User.findAll({
      where: whereClause,
      attributes: ['id', 'fName', 'lName', 'email', 'role'],
      include: includeClause,
      order: [['fName', 'ASC'], ['lName', 'ASC']]
    });

    // Transform the data to match frontend expectations
    const transformedStudents = students.map(student => {
      const studentData = student.toJSON();
      return {
        user_id: studentData.id,
        first_name: studentData.fName,
        last_name: studentData.lName,
        email: studentData.email,
        role: studentData.role,
        qualifications: studentData.qualifications.map(qual => ({
          qualification_id: qual.qualification_id,
          qualification_name: qual.qualification_name,
          description: qual.description,
          requires_document: qual.requires_document,
          approval_status: qual.userQualification?.approval_status || 'PENDING',
          approved_at: qual.userQualification?.approved_at,
          document_name: qual.userQualification?.document_name,
          user_qualification_id: qual.userQualification?.user_qualification_id
        }))
      };
    });

    res.status(200).send(transformedStudents);
  } catch (error) {
    console.error('Error getting students with qualifications:', error);
    res.status(500).send({
      message: "Error retrieving students with qualifications."
    });
  }
};

// Get qualifications for a specific student
export const getStudentQualifications = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the user exists and is a student
    const student = await User.findOne({
      where: { id: userId, role: 'student' },
      attributes: ['id', 'fName', 'lName', 'email', 'role']
    });

    if (!student) {
      return res.status(404).send({
        message: "Student not found."
      });
    }

    const userQualifications = await UserQualification.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Qualification,
          as: 'qualification',
          attributes: ['qualification_id', 'qualification_name', 'description', 'requires_document']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'fName', 'lName'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Transform the data to match frontend expectations
    const transformedQualifications = userQualifications.map(uq => ({
      user_qualification_id: uq.user_qualification_id,
      qualification_id: uq.qualification.qualification_id,
      qualification_name: uq.qualification.qualification_name,
      description: uq.qualification.description,
      requires_document: uq.qualification.requires_document,
      approval_status: uq.approval_status,
      approved_at: uq.approved_at,
      document_name: uq.document_name,
      approved_by: uq.approver ? `${uq.approver.fName} ${uq.approver.lName}` : null
    }));

    res.status(200).send(transformedQualifications);
  } catch (error) {
    console.error('Error getting student qualifications:', error);
    res.status(500).send({
      message: "Error retrieving student qualifications."
    });
  }
};

// Get required qualifications for a position
export const getPositionRequiredQualifications = async (req, res) => {
  try {
    const { positionId } = req.params;

    // Verify the position exists
    const position = await Position.findByPk(positionId);
    if (!position) {
      return res.status(404).send({
        message: "Position not found."
      });
    }

    const positionQualifications = await PositionQualification.findAll({
      where: { position_id: positionId },
      include: [
        {
          model: Qualification,
          as: 'qualification',
          attributes: ['qualification_id', 'qualification_name', 'description', 'requires_document']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    // Transform the data to match frontend expectations
    const transformedQualifications = positionQualifications.map(pq => ({
      qualification_id: pq.qualification.qualification_id,
      qualification_name: pq.qualification.qualification_name,
      description: pq.qualification.description,
      requires_document: pq.qualification.requires_document
    }));

    res.status(200).send(transformedQualifications);
  } catch (error) {
    console.error('Error getting position required qualifications:', error);
    res.status(500).send({
      message: "Error retrieving position required qualifications."
    });
  }
};

// Get all available qualifications
export const getAllQualifications = async (req, res) => {
  try {
    const qualifications = await Qualification.findAll({
      attributes: ['qualification_id', 'qualification_name', 'description', 'requires_document'],
      order: [['qualification_name', 'ASC']]
    });

    // Transform the data to match frontend expectations
    const transformedQualifications = qualifications.map(qual => ({
      qualification_id: qual.qualification_id,
      qualification_name: qual.qualification_name,
      description: qual.description,
      requires_document: qual.requires_document
    }));

    res.status(200).send(transformedQualifications);
  } catch (error) {
    console.error('Error getting all qualifications:', error);
    res.status(500).send({
      message: "Error retrieving qualifications."
    });
  }
};

// Check if user is qualified for a position
export const checkUserQualificationForPosition = async (req, res) => {
  try {
    const { userId, positionId } = req.body;

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({
        message: "User not found."
      });
    }

    // Verify position exists
    const position = await Position.findByPk(positionId);
    if (!position) {
      return res.status(404).send({
        message: "Position not found."
      });
    }

    // Get required qualifications for the position
    const requiredQualifications = await PositionQualification.findAll({
      where: { position_id: positionId },
      include: [
        {
          model: Qualification,
          as: 'qualification',
          attributes: ['qualification_id', 'qualification_name']
        }
      ]
    });

    if (requiredQualifications.length === 0) {
      return res.status(200).send({
        isQualified: true,
        message: "No qualifications required for this position."
      });
    }

    // Get user's approved qualifications
    const userQualifications = await UserQualification.findAll({
      where: { 
        user_id: userId,
        approval_status: 'APPROVED'
      },
      include: [
        {
          model: Qualification,
          as: 'qualification',
          attributes: ['qualification_id', 'qualification_name']
        }
      ]
    });

    const userQualIds = userQualifications.map(uq => uq.qualification_id);
    const requiredQualIds = requiredQualifications.map(rq => rq.qualification_id);

    // Check if user has all required qualifications
    const missingQualifications = requiredQualifications.filter(rq => !userQualIds.includes(rq.qualification_id));
    
    if (missingQualifications.length === 0) {
      res.status(200).send({
        isQualified: true,
        message: "User has all required qualifications."
      });
    } else {
      const missingQualNames = missingQualifications.map(mq => mq.qualification.qualification_name);
      res.status(400).send({
        isQualified: false,
        message: `User is missing required qualifications: ${missingQualNames.join(', ')}`,
        missingQualifications: missingQualifications.map(mq => ({
          qualification_id: mq.qualification_id,
          qualification_name: mq.qualification.qualification_name
        }))
      });
    }
  } catch (error) {
    console.error('Error checking user qualification for position:', error);
    res.status(500).send({
      message: "Error checking user qualification for position."
    });
  }
};
