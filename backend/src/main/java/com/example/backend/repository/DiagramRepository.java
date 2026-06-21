package com.example.backend.repository;

import com.example.backend.entity.Diagram;
import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiagramRepository extends JpaRepository<Diagram, Long> {
    List<Diagram> findByOwner(User owner);

    @Query("SELECT DISTINCT d FROM Diagram d JOIN d.participantRoles pr WHERE pr.user.id = :userId")
    List<Diagram> findByParticipantUserId(@Param("userId") Long userId);
}
