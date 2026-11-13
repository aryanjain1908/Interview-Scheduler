"""initial schema

Revision ID: fb9774122a19
Revises: 
Create Date: 2026-11-12 10:15:56.381967
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'fb9774122a19'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('badges',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('slug', sa.String(length=60), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('color', sa.String(length=20), nullable=False),
    sa.Column('max_attempts', sa.Integer(), nullable=False),
    sa.Column('interview_minutes', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('slug')
    )
    op.create_table('skills',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('student', 'interviewer', 'admin', name='role', native_enum=False, length=32), nullable=False),
    sa.Column('college', sa.String(length=160), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_table('availability_windows',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('interviewer_id', sa.Uuid(), nullable=False),
    sa.Column('weekday', sa.SmallInteger(), nullable=True),
    sa.Column('specific_date', sa.Date(), nullable=True),
    sa.Column('start_time', sa.Time(), nullable=False),
    sa.Column('end_time', sa.Time(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('(weekday IS NULL) <> (specific_date IS NULL)', name='ck_window_weekday_xor_date'),
    sa.CheckConstraint('start_time < end_time', name='ck_window_time_order'),
    sa.ForeignKeyConstraint(['interviewer_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_availability_windows_interviewer_id'), 'availability_windows', ['interviewer_id'], unique=False)
    op.create_table('badge_skills',
    sa.Column('badge_id', sa.Uuid(), nullable=False),
    sa.Column('skill_id', sa.Uuid(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('badge_id', 'skill_id')
    )
    op.create_table('interview_journeys',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('student_id', sa.Uuid(), nullable=False),
    sa.Column('badge_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('not_eligible', 'eligible', 'booked', 'in_progress', 'passed', 'failed', 'retake_later', 'no_show', 'badge_revoked', name='journeystatus', native_enum=False, length=32), nullable=False),
    sa.Column('attempts_used', sa.Integer(), nullable=False),
    sa.Column('reschedules_used', sa.Integer(), nullable=False),
    sa.Column('eligible_since', sa.DateTime(timezone=True), nullable=True),
    sa.Column('eligible_again_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('priority_rebook', sa.Boolean(), nullable=False),
    sa.Column('last_nudged_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('student_id', 'badge_id', name='uq_journey_student_badge')
    )
    op.create_index(op.f('ix_interview_journeys_badge_id'), 'interview_journeys', ['badge_id'], unique=False)
    op.create_index(op.f('ix_interview_journeys_status'), 'interview_journeys', ['status'], unique=False)
    op.create_index(op.f('ix_interview_journeys_student_id'), 'interview_journeys', ['student_id'], unique=False)
    op.create_table('malpractice_flags',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('student_id', sa.Uuid(), nullable=False),
    sa.Column('badge_id', sa.Uuid(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('evidence_url', sa.String(length=500), nullable=True),
    sa.Column('resolution', sa.Enum('pending', 'upheld', 'dismissed', name='flagresolution', native_enum=False, length=32), nullable=False),
    sa.Column('flagged_by', sa.Uuid(), nullable=False),
    sa.Column('resolved_by', sa.Uuid(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['flagged_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_malpractice_flags_resolution'), 'malpractice_flags', ['resolution'], unique=False)
    op.create_index(op.f('ix_malpractice_flags_student_id'), 'malpractice_flags', ['student_id'], unique=False)
    op.create_table('notifications',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sa.String(length=40), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('tone', sa.String(length=20), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_table('slots',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('interviewer_id', sa.Uuid(), nullable=False),
    sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.Enum('open', 'booked', 'blocked', name='slotstatus', native_enum=False, length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['interviewer_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('interviewer_id', 'start_at', name='uq_slot_interviewer_start')
    )
    op.create_index('ix_slots_start_status', 'slots', ['start_at', 'status'], unique=False)
    op.create_table('student_skill_clears',
    sa.Column('student_id', sa.Uuid(), nullable=False),
    sa.Column('skill_id', sa.Uuid(), nullable=False),
    sa.Column('cleared_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('student_id', 'skill_id')
    )
    op.create_table('interview_events',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('journey_id', sa.Uuid(), nullable=False),
    sa.Column('from_status', sa.Enum('not_eligible', 'eligible', 'booked', 'in_progress', 'passed', 'failed', 'retake_later', 'no_show', 'badge_revoked', name='journeystatus', native_enum=False, length=32), nullable=True),
    sa.Column('to_status', sa.Enum('not_eligible', 'eligible', 'booked', 'in_progress', 'passed', 'failed', 'retake_later', 'no_show', 'badge_revoked', name='journeystatus', native_enum=False, length=32), nullable=False),
    sa.Column('actor_id', sa.Uuid(), nullable=True),
    sa.Column('reason', sa.String(length=300), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['journey_id'], ['interview_journeys.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_interview_events_journey_id'), 'interview_events', ['journey_id'], unique=False)
    op.create_table('interviews',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('journey_id', sa.Uuid(), nullable=False),
    sa.Column('slot_id', sa.Uuid(), nullable=False),
    sa.Column('student_id', sa.Uuid(), nullable=False),
    sa.Column('interviewer_id', sa.Uuid(), nullable=False),
    sa.Column('badge_id', sa.Uuid(), nullable=False),
    sa.Column('attempt_no', sa.Integer(), nullable=False),
    sa.Column('status', sa.Enum('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled_student', 'cancelled_interviewer', name='interviewstatus', native_enum=False, length=32), nullable=False),
    sa.Column('meeting_link', sa.String(length=255), nullable=False),
    sa.Column('booked_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancel_reason', sa.String(length=300), nullable=True),
    sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ),
    sa.ForeignKeyConstraint(['interviewer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['journey_id'], ['interview_journeys.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['slot_id'], ['slots.id'], ),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_interviews_interviewer_id'), 'interviews', ['interviewer_id'], unique=False)
    op.create_index(op.f('ix_interviews_journey_id'), 'interviews', ['journey_id'], unique=False)
    op.create_index(op.f('ix_interviews_status'), 'interviews', ['status'], unique=False)
    op.create_index(op.f('ix_interviews_student_id'), 'interviews', ['student_id'], unique=False)
    op.create_index('uq_interviews_active_journey', 'interviews', ['journey_id'], unique=True, postgresql_where=sa.text("status IN ('scheduled', 'in_progress')"))
    op.create_index('uq_interviews_active_slot', 'interviews', ['slot_id'], unique=True, postgresql_where=sa.text("status IN ('scheduled', 'in_progress')"))
    op.create_table('interview_outcomes',
    sa.Column('interview_id', sa.Uuid(), nullable=False),
    sa.Column('result', sa.Enum('pass', 'fail', 'retake_later', name='outcomeresult', native_enum=False, length=32), nullable=False),
    sa.Column('scores', sa.JSON(), nullable=False),
    sa.Column('feedback_to_student', sa.Text(), nullable=False),
    sa.Column('internal_notes', sa.Text(), nullable=False),
    sa.Column('retake_after', sa.Date(), nullable=True),
    sa.Column('recorded_by', sa.Uuid(), nullable=False),
    sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['recorded_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('interview_id')
    )
    op.create_table('student_badges',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('student_id', sa.Uuid(), nullable=False),
    sa.Column('badge_id', sa.Uuid(), nullable=False),
    sa.Column('interview_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.Enum('active', 'revoked', name='studentbadgestatus', native_enum=False, length=32), nullable=False),
    sa.Column('awarded_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoke_reason', sa.String(length=300), nullable=True),
    sa.ForeignKeyConstraint(['badge_id'], ['badges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('student_id', 'badge_id', name='uq_student_badge')
    )
    op.create_index(op.f('ix_student_badges_student_id'), 'student_badges', ['student_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_student_badges_student_id'), table_name='student_badges')
    op.drop_table('student_badges')
    op.drop_table('interview_outcomes')
    op.drop_index('uq_interviews_active_slot', table_name='interviews', postgresql_where=sa.text("status IN ('scheduled', 'in_progress')"))
    op.drop_index('uq_interviews_active_journey', table_name='interviews', postgresql_where=sa.text("status IN ('scheduled', 'in_progress')"))
    op.drop_index(op.f('ix_interviews_student_id'), table_name='interviews')
    op.drop_index(op.f('ix_interviews_status'), table_name='interviews')
    op.drop_index(op.f('ix_interviews_journey_id'), table_name='interviews')
    op.drop_index(op.f('ix_interviews_interviewer_id'), table_name='interviews')
    op.drop_table('interviews')
    op.drop_index(op.f('ix_interview_events_journey_id'), table_name='interview_events')
    op.drop_table('interview_events')
    op.drop_table('student_skill_clears')
    op.drop_index('ix_slots_start_status', table_name='slots')
    op.drop_table('slots')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_malpractice_flags_student_id'), table_name='malpractice_flags')
    op.drop_index(op.f('ix_malpractice_flags_resolution'), table_name='malpractice_flags')
    op.drop_table('malpractice_flags')
    op.drop_index(op.f('ix_interview_journeys_student_id'), table_name='interview_journeys')
    op.drop_index(op.f('ix_interview_journeys_status'), table_name='interview_journeys')
    op.drop_index(op.f('ix_interview_journeys_badge_id'), table_name='interview_journeys')
    op.drop_table('interview_journeys')
    op.drop_table('badge_skills')
    op.drop_index(op.f('ix_availability_windows_interviewer_id'), table_name='availability_windows')
    op.drop_table('availability_windows')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('skills')
    op.drop_table('badges')
