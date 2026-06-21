package com.example.backend.repository;

import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.isActive = true " +
            "AND u.id != :currentUserId " +
            "AND (LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%'))) " +
            "ORDER BY u.username")
    List<User> searchUsers(@Param("query") String query, @Param("currentUserId") Long currentUserId);

    @Query("SELECT u FROM User u WHERE u.isActive = true " +
            "AND u.id != :currentUserId " +
            "AND NOT EXISTS (SELECT d FROM Diagram d WHERE d.id = :diagramId AND d.owner = u) " +
            "AND u.id NOT IN (SELECT dp.user.id FROM DiagramParticipant dp WHERE dp.diagram.id = :diagramId) " +
            "AND (LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%'))) " +
            "ORDER BY u.username")
    List<User> searchUsersForDiagram(@Param("query") String query,
                                     @Param("currentUserId") Long currentUserId,
                                     @Param("diagramId") Long diagramId);
}