package com.example.backend.service;

import com.example.backend.entity.Diagram;
import com.example.backend.entity.DiagramParticipant;
import com.example.backend.entity.User;
import com.example.backend.repository.DiagramRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.stream.Collectors;

import java.util.List;

import com.example.backend.entity.ParticipantRole;

@Service
public class DiagramService {

    private final DiagramRepository diagramRepository;
    private final UserService userService;

    @Autowired
    public DiagramService(DiagramRepository diagramRepository, UserService userService) {
        this.diagramRepository = diagramRepository;
        this.userService = userService;
    }

    @Transactional
    public Diagram createDiagram(String name, Long ownerId) {
        User owner = userService.findById(ownerId);
        Diagram diagram = new Diagram();
        diagram.setName(name);
        diagram.setOwner(owner);
        return diagramRepository.save(diagram);
    }

    public Diagram findById(Long id) {
        return diagramRepository.findById(id).orElseThrow(() -> new RuntimeException("Diagram not found"));
    }

    @Transactional
    public void deleteDiagram(Long id) {
        diagramRepository.deleteById(id);
    }

    public List<Diagram> getAllDiagrams() {
        return diagramRepository.findAll();
    }
    @Transactional
    public Diagram addParticipant(Long diagramId, Long userId, ParticipantRole role) {
        Diagram diagram = findById(diagramId);
        User user = userService.findById(userId);

        // Проверка, не является ли уже участником
        if (diagram.getParticipants().contains(user)) {
            throw new RuntimeException("User is already a participant");
        }

        diagram.getParticipants().add(user);


        DiagramParticipant participant = new DiagramParticipant(diagram, user, role);
        diagram.getParticipantRoles().add(participant);

        return diagramRepository.save(diagram);
    }


    @Transactional
    public Diagram removeParticipant(Long diagramId, Long userId) {
        Diagram diagram = findById(diagramId);
        User user = userService.findById(userId);

        diagram.getParticipants().remove(user);


        diagram.getParticipantRoles().removeIf(p -> p.getUser().getId().equals(userId));

        return diagramRepository.save(diagram);
    }


    public List<User> getParticipants(Long diagramId) {
        Diagram diagram = findById(diagramId);
        return diagram.getParticipants();
    }


    public boolean hasAccess(Long diagramId, Long userId, ParticipantRole requiredRole) {
        Diagram diagram = findById(diagramId);
        User user = userService.findById(userId);


        if (diagram.getOwner().getId().equals(userId)) {
            return true;
        }


        return diagram.getParticipantRoles().stream()
                .filter(p -> p.getUser().getId().equals(userId))
                .anyMatch(p -> {
                    switch (requiredRole) {
                        case EDITOR:
                            return p.getRole() == ParticipantRole.EDITOR || p.getRole() == ParticipantRole.OWNER;
                        case VIEWER:
                            return true;
                        default:
                            return false;
                    }
                });
    }

    public List<Diagram> getMyDiagrams(Long userId) {
        User user = userService.findById(userId);


        List<Diagram> ownedDiagrams = diagramRepository.findByOwner(user);


        List<Diagram> participatedDiagrams = user.getParticipatedDiagrams();

        List<Diagram> allDiagrams = new ArrayList<>();
        allDiagrams.addAll(ownedDiagrams);
        allDiagrams.addAll(participatedDiagrams);

        return allDiagrams.stream().distinct().collect(Collectors.toList());
    }

    @Transactional
    public Diagram updateDiagram(Long id, String name, String description, Long userId) {
        Diagram diagram = findById(id);

        if (!hasAccess(id, userId, ParticipantRole.EDITOR)) {
            throw new RuntimeException("Access denied: You don't have permission to edit this diagram");
        }

        if (name != null && !name.isBlank()) {
            diagram.setName(name);
        }

        if (description != null) {
            diagram.setDescription(description);
        }

        return diagramRepository.save(diagram);
    }

    public ParticipantRole getUserRoleInDiagram(Long diagramId, Long userId) {
        Diagram diagram = findById(diagramId);


        if (diagram.getOwner().getId().equals(userId)) {
            return ParticipantRole.OWNER;
        }


        return diagram.getParticipantRoles().stream()
                .filter(p -> p.getUser().getId().equals(userId))
                .map(DiagramParticipant::getRole)
                .findFirst()
                .orElse(null);
    }
}